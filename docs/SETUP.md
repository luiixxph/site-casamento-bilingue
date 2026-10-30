# Instalação passo a passo

Este guia transforma a demo em um site real: as confirmações vão para uma planilha, o casal recebe e-mails e o painel mostra os dados de verdade. Leva cerca de 20 minutos.

## 1. Personalize o conteúdo

Tudo fica no `index.html`. Procure e troque:

| O quê | Onde procurar |
|---|---|
| Nomes do casal e monograma | `Clara`, `Theo`, `C <span>&amp;</span> T` e o `<title>` |
| Data e horário | `11 de março de 2028`, `March 11, 2028` e `var target=Date.parse(...)` |
| Prazo de confirmação | `31 de janeiro de 2028` e `var RSVP_FECHA=Date.parse(...)` |
| Local e endereço | `Recanto da Maré` e o link do Google Maps |
| Evento na agenda | `cal-link` no JavaScript e o arquivo `casamento.ics` |
| História, fotos e textos | seções `#historia`, `#guia`, `#favoritos`, `#hospedagem` e `#presentes` |
| PIX | `id="pix-code"` (BR Code) e o SVG do QR dentro de `.qr-img` |
| Prévia do link | `og:title`, `og:url`, `og:image` e o arquivo `og.jpg` |

Também apague o aviso flutuante de demo (`id="demo-pill"`) e a dica de código na tela do painel.

> **PIX:** gere o "Pix Copia e Cola" no app do banco e use uma chave aleatória, para não expor CPF ou telefone. O QR code pode ser gerado a partir desse mesmo texto.

## 2. Planilha e Apps Script

1. Na conta Google dos noivos, crie uma planilha (ex.: "RSVP Casamento").
2. Abra **Extensões → Apps Script**, apague o conteúdo e cole o arquivo [`apps-script/Code.gs`](../apps-script/Code.gs).
3. No topo do arquivo, ajuste:
   - `EMAILS_AVISO`: e-mail dos noivos. Para dois, separe por vírgula.
   - `PAINEL_CODIGO`: código do painel, com 10 ou mais caracteres misturando letras e números.
   - `NOME_REMETENTE` e `SITE`: nome que aparece nos e-mails e endereço do site.
   - Os textos do e-mail (data, local, prazo), na função `enviarConfirmacaoConvidado`.
4. Rode a função `testar` uma vez e autorize as permissões. Uma linha de teste deve aparecer na aba **Confirmações**, e o e-mail de aviso deve chegar. Depois, apague a linha.
5. Vá em **Implantar → Nova implantação → App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
6. Copie a URL que termina em `/exec`.

> **Mudou o código depois?** Vá em *Implantar → Gerenciar implantações → lápis → Versão: Nova versão → Implantar*. Sem isso, o site continua usando a versão antiga. A URL `/exec` não muda.

## 3. Ligue o site à planilha

No `index.html`, troque a linha:

```js
var RSVP_ENDPOINT='';
```

pela URL copiada:

```js
var RSVP_ENDPOINT='https://script.google.com/macros/s/SEU_ID/exec';
```

Com a URL preenchida, o modo demonstração desliga sozinho: o formulário passa a gravar na planilha, e o painel passa a exigir o código configurado.

## 4. Publique

**Cloudflare Pages:** Workers & Pages → Create → Pages → *Upload assets* → envie a pasta do projeto. Se tiver um domínio próprio, conecte em *Custom domains*.

**GitHub Pages:** Settings → Pages → *Deploy from a branch* → `main` / raiz. O arquivo `.nojekyll` já está incluído.

**Site privado:** para que o site não apareça no Google, adicione no `<head>`:

```html
<meta name="robots" content="noindex, nofollow">
```

## 5. Teste antes de divulgar

- [ ] Confirmar presença com e-mail e conferir se a linha chega na planilha e se os dois e-mails chegam.
- [ ] Abrir `/#painel`, entrar com o código e conferir os totais.
- [ ] Trocar PT/EN em todas as telas.
- [ ] Salvar na agenda pelo Google e pelo `.ics`.
- [ ] Compartilhar o link no WhatsApp e conferir a prévia.
- [ ] Ler o QR do PIX com o app do banco, sem concluir o pagamento.
- [ ] Apagar as linhas de teste da planilha.
