/**
 * RSVP – Site de casamento (backend em Google Apps Script)
 * Recebe as confirmações do site, salva na planilha e avisa os noivos por e-mail.
 *
 * Como instalar (na conta Google dos noivos):
 * 1. Crie uma planilha nova no Google Sheets (ex.: "RSVP Casamento").
 * 2. Menu Extensões > Apps Script. Apague o que estiver lá e cole este arquivo inteiro.
 * 3. Troque o e-mail em EMAILS_AVISO abaixo e salve.
 * 4. Implantar > Nova implantação > tipo "App da Web".
 *    - Executar como: Eu
 *    - Quem pode acessar: Qualquer pessoa
 *    Autorize quando o Google pedir.
 * 5. Copie a URL que termina em /exec e cole no site, na linha var RSVP_ENDPOINT='...'.
 * 6. Troque PAINEL_CODIGO e passe o código só para os noivos. O painel fica em site.com/#painel.
 *
 * Mudou algo neste arquivo depois de implantar? Implantar > Gerenciar implantações >
 * lápis > Versão: Nova versão > Implantar. Assim a URL /exec continua a mesma.
 */

const EMAILS_AVISO = 'EMAIL_DOS_NOIVOS@gmail.com'; // dá para colocar dois, separados por vírgula
// Código do painel dos noivos (site.com/#painel). Use 10+ caracteres, misturando letras e números.
// Enquanto estiver com este valor padrão, o painel recusa qualquer código.
const PAINEL_CODIGO = 'TROQUE-ESTE-CODIGO';
const ABA = 'Confirmações';
const CABECALHO = ['Data e hora', 'Nome', 'Vai?', 'Pessoas', 'Restrições alimentares', 'Observações', 'Idioma', 'Atualização?', 'E-mail'];
const NOME_REMETENTE = 'Clara & Theo'; // nome que aparece como remetente dos e-mails
const SITE = 'https://SEU-SITE.pages.dev';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    const nome = limpar(d.nome, 120);
    if (!nome) return resposta({ ok: false });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let aba = ss.getSheetByName(ABA);
    if (!aba) {
      aba = ss.insertSheet(ABA);
      aba.appendRow(CABECALHO);
      aba.setFrozenRows(1);
      aba.getRange(1, 1, 1, CABECALHO.length).setFontWeight('bold');
    }

    if (aba.getRange(1, 9).getValue() === '') aba.getRange(1, 9).setValue('E-mail').setFontWeight('bold');

    const vai = d.presenca === 'sim';
    const pessoas = vai ? Math.min(10, Math.max(1, Number(d.pessoas) || 1)) : 0;
    const emailConvidado = emailValido(d.email) ? String(d.email).trim().slice(0, 200) : '';
    const linhas = aba.getDataRange().getValues().slice(1);
    const jaRespondeu = linhas.some(function (l) { return normalizar(l[1]) === normalizar(nome); });

    aba.appendRow([
      new Date(), nome, vai ? 'Sim' : 'Não', pessoas,
      limpar(d.restricoes, 500), limpar(d.observacoes, 1000),
      d.idioma === 'en' ? 'Inglês' : 'Português',
      jaRespondeu ? 'Sim, substitui a resposta anterior' : '',
      emailConvidado
    ]);

    // 1) aviso para os noivos
    const total = totalConfirmado(aba);
    const assunto = vai
      ? nome + ' confirmou presença (' + pessoas + (pessoas > 1 ? ' pessoas)' : ' pessoa)')
      : nome + ' não poderá ir';
    const linhasAviso = [];
    if (jaRespondeu) linhasAviso.push('Atenção: esta pessoa já tinha respondido. Vale a resposta mais recente.', '');
    linhasAviso.push('Nome: ' + nome, 'Vai: ' + (vai ? 'Sim' : 'Não'));
    if (vai) linhasAviso.push('Pessoas: ' + pessoas);
    if (d.restricoes) linhasAviso.push('Restrições alimentares: ' + limpar(d.restricoes, 500));
    if (d.observacoes) linhasAviso.push('Observações: ' + limpar(d.observacoes, 1000));
    if (emailConvidado) linhasAviso.push('E-mail: ' + emailConvidado);
    linhasAviso.push('', 'Total confirmado até agora: ' + total + (total === 1 ? ' pessoa' : ' pessoas'), 'Planilha completa: ' + ss.getUrl());

    try {
      MailApp.sendEmail({ to: EMAILS_AVISO, subject: assunto, body: linhasAviso.join('\n'), name: NOME_REMETENTE });
    } catch (errEmail) {
      registrarErro('aviso para os noivos', errEmail, nome);
    }

    // 2) confirmação para o convidado (só se ele informou um e-mail válido)
    if (emailConvidado) {
      try {
        enviarConfirmacaoConvidado(emailConvidado, nome, vai, pessoas, limpar(d.restricoes, 500), d.idioma === 'en');
      } catch (errConv) {
        registrarErro('confirmação para o convidado', errConv, nome + ' <' + emailConvidado + '>');
      }
    }
    return resposta({ ok: true });
  } catch (err) {
    registrarErro('gravação da confirmação', err, e && e.postData ? String(e.postData.contents).slice(0, 300) : '');
    return resposta({ ok: false });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Painel dos noivos: devolve a lista (a resposta mais recente de cada nome) só para quem
 * enviar o código certo. Depois de 20 tentativas erradas, bloqueia por 10 minutos.
 */
function doGet(e) {
  const cache = CacheService.getScriptCache();
  const falhas = Number(cache.get('falhas') || 0);
  if (falhas >= 20) return resposta({ ok: false, erro: 'bloqueado' });

  const codigo = String((e && e.parameter && e.parameter.code) || '');
  if (PAINEL_CODIGO === 'TROQUE-ESTE-CODIGO' || codigo !== PAINEL_CODIGO) {
    cache.put('falhas', String(falhas + 1), 600);
    return resposta({ ok: false, erro: 'codigo' });
  }

  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
  const linhas = aba ? aba.getDataRange().getValues().slice(1) : [];
  const porNome = {};
  linhas.forEach(function (l) {
    const chave = normalizar(l[1]);
    if (!chave) return;
    const anterior = porNome[chave];
    porNome[chave] = {
      data: l[0] instanceof Date ? l[0].toISOString() : String(l[0]),
      nome: String(l[1]),
      vai: l[2] === 'Sim',
      pessoas: Number(l[3]) || 0,
      restricoes: String(l[4] || ''),
      observacoes: String(l[5] || ''),
      respostas: (anterior ? anterior.respostas : 0) + 1
    };
  });

  return resposta({
    ok: true,
    atualizadoEm: new Date().toISOString(),
    convidados: Object.keys(porNome).map(function (k) { return porNome[k]; })
  });
}

function emailValido(v) {
  return /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]{2,}$/.test(String(v || '').trim());
}

function escaparHtml(t) {
  return String(t || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}

/** E-mail para o convidado, no idioma que ele usou no site. As respostas vão para os noivos. */
function enviarConfirmacaoConvidado(para, nome, vai, pessoas, restricoes, ingles) {
  const primeiro = nome.split(' ')[0];
  const mapa = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Ribeirão da Ilha, Florianópolis - SC');
  const T = ingles ? {
    assuntoSim: 'RSVP confirmed · Clara & Theo’s wedding',
    assuntoNao: 'Thank you for letting us know · Clara & Theo',
    oi: 'Hi ' + primeiro + '!',
    sim: 'We have your RSVP for ' + pessoas + (pessoas > 1 ? ' people' : ' person') + '. We can’t wait to celebrate with you!',
    nao: 'We are sorry you can’t make it, and we are grateful you let us know. You will be in our hearts on the day.',
    quando: 'When', quandoTxt: 'Saturday, March 11, 2028, at 3:30 pm. Reception right after the ceremony, at the same venue.',
    onde: 'Where', mapaTxt: 'View on map',
    traje: 'Dress code', trajeTxt: 'Formal / elegant, with Florianópolis’ weather in mind.',
    chegar: 'Getting there', chegarTxt: 'We recommend an Uber or taxi both ways, so everyone can enjoy the party.',
    restr: 'Dietary needs you told us',
    site: 'Travel guide, where to stay and gifts:',
    mudar: 'Need to change something? Send a new reply on the website by January 31, 2028, or just reply to this email.',
    beijo: 'With love,'
  } : {
    assuntoSim: 'Presença confirmada · Casamento Clara & Theo',
    assuntoNao: 'Obrigado por nos avisar · Clara & Theo',
    oi: 'Olá, ' + primeiro + '!',
    sim: 'Recebemos sua confirmação para ' + pessoas + (pessoas > 1 ? ' pessoas' : ' pessoa') + '. Mal podemos esperar para celebrar com você!',
    nao: 'Que pena que você não poderá ir, e obrigado por nos avisar. Você vai estar no nosso coração nesse dia.',
    quando: 'Quando', quandoTxt: 'Sábado, 11 de março de 2028, às 15h30. Recepção logo após a cerimônia, no mesmo local.',
    onde: 'Onde', mapaTxt: 'Ver no mapa',
    traje: 'Dress code', trajeTxt: 'Formal / elegante, pensando no clima de Florianópolis.',
    chegar: 'Como chegar', chegarTxt: 'Recomendamos ir e voltar de Uber ou táxi, para todos curtirem a festa sem precisar dirigir.',
    restr: 'Restrições que você informou',
    site: 'Guia da cidade, hospedagem e presentes:',
    mudar: 'Precisa mudar algo? Envie uma nova resposta pelo site até 31 de janeiro de 2028, ou é só responder este e-mail.',
    beijo: 'Com carinho,'
  };
  const endereco = 'Recanto da Maré (local fictício) · Ribeirão da Ilha, Florianópolis – SC';

  const texto = [T.oi, '', vai ? T.sim : T.nao, ''];
  if (vai) {
    texto.push(T.quando + ': ' + T.quandoTxt, T.onde + ': ' + endereco + ' (' + mapa + ')', T.traje + ': ' + T.trajeTxt, T.chegar + ': ' + T.chegarTxt);
    if (restricoes) texto.push(T.restr + ': ' + restricoes);
    texto.push('', T.site + ' ' + SITE, '', T.mudar);
  } else {
    texto.push(SITE);
  }
  texto.push('', T.beijo, 'Clara & Theo');

  const item = function (rot, val) {
    return '<tr><td style="padding:8px 0;border-top:1px solid #E6DCCB;vertical-align:top;width:120px;font:700 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#625D54">' + rot + '</td>' +
      '<td style="padding:8px 0;border-top:1px solid #E6DCCB;font:15px/1.5 Arial,sans-serif;color:#2A2A28">' + val + '</td></tr>';
  };
  let html = '<div style="background:#FBF8F2;padding:24px 12px"><div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E6DCCB;border-radius:16px;padding:28px 24px">' +
    '<div style="font:italic 26px Georgia,serif;color:#2F5D50;text-align:center;margin-bottom:4px">Clara <span style="color:#C98F22">&amp;</span> Theo</div>' +
    '<div style="font:12px Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#B4583F;text-align:center;margin-bottom:22px">11 · 03 · 2028</div>' +
    '<p style="font:16px/1.6 Arial,sans-serif;color:#2A2A28;margin:0 0 10px">' + escaparHtml(T.oi) + '</p>' +
    '<p style="font:16px/1.6 Arial,sans-serif;color:#2A2A28;margin:0 0 18px">' + escaparHtml(vai ? T.sim : T.nao) + '</p>';
  if (vai) {
    html += '<table style="width:100%;border-collapse:collapse;margin-bottom:18px">' +
      item(T.quando, escaparHtml(T.quandoTxt)) +
      item(T.onde, escaparHtml(endereco) + '<br><a href="' + mapa + '" style="color:#2B6F94;font-weight:700">' + T.mapaTxt + '</a>') +
      item(T.traje, escaparHtml(T.trajeTxt)) +
      item(T.chegar, escaparHtml(T.chegarTxt)) +
      (restricoes ? item(T.restr, escaparHtml(restricoes)) : '') +
      '</table>' +
      '<p style="font:15px/1.6 Arial,sans-serif;color:#2A2A28;margin:0 0 6px">' + escaparHtml(T.site) + '</p>' +
      '<p style="margin:0 0 18px"><a href="' + SITE + '" style="display:inline-block;background:#B4583F;color:#FFFFFF;text-decoration:none;font:700 14px Arial,sans-serif;padding:12px 22px;border-radius:999px">' + SITE.replace(/^https?:\/\//, '') + '</a></p>' +
      '<p style="font:13px/1.5 Arial,sans-serif;color:#625D54;margin:0 0 18px">' + escaparHtml(T.mudar) + '</p>';
  } else {
    html += '<p style="margin:0 0 18px"><a href="' + SITE + '" style="color:#2B6F94;font-weight:700">' + SITE.replace(/^https?:\/\//, '') + '</a></p>';
  }
  html += '<p style="font:italic 18px Georgia,serif;color:#2F5D50;margin:0">' + T.beijo + '<br>Clara &amp; Theo</p></div></div>';

  const opcoes = { to: para, subject: vai ? T.assuntoSim : T.assuntoNao, body: texto.join('\n'), htmlBody: html, name: NOME_REMETENTE };
  const respostaPara = String(EMAILS_AVISO).split(',')[0].trim();
  if (emailValido(respostaPara)) opcoes.replyTo = respostaPara;
  MailApp.sendEmail(opcoes);
}

/** Anota qualquer falha numa aba "Erros" da planilha (e no registro de Execuções). */
function registrarErro(etapa, err, detalhe) {
  try {
    console.error(etapa + ': ' + err);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let aba = ss.getSheetByName('Erros');
    if (!aba) { aba = ss.insertSheet('Erros'); aba.appendRow(['Data e hora', 'Etapa', 'Erro', 'Detalhe']); aba.setFrozenRows(1); }
    aba.appendRow([new Date(), etapa, String(err && err.message ? err.message : err), String(detalhe || '')]);
  } catch (e2) { console.error('Falha ao registrar erro: ' + e2); }
}

/** Soma as pessoas confirmadas, considerando só a resposta mais recente de cada nome. */
function totalConfirmado(aba) {
  const ultima = {};
  aba.getDataRange().getValues().slice(1).forEach(function (l) {
    ultima[normalizar(l[1])] = l[2] === 'Sim' ? Number(l[3]) || 0 : 0;
  });
  return Object.keys(ultima).reduce(function (s, k) { return s + ultima[k]; }, 0);
}

/** Corta o tamanho e impede que um texto vire fórmula na planilha. */
function limpar(v, max) {
  const t = String(v || '').trim().slice(0, max);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function normalizar(v) {
  return String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Rode esta função uma vez pelo editor para testar o e-mail e a planilha. */
function testar() {
  // Para testar também o e-mail do convidado, troque o e-mail abaixo por um seu.
  doPost({ postData: { contents: JSON.stringify({ nome: 'Teste do Site', presenca: 'sim', pessoas: 2, restricoes: 'nenhuma', observacoes: 'teste', idioma: 'pt', email: 'convidado.teste@example.com' }) } });
}
