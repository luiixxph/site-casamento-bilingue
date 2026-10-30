# Estudo de caso · Site de casamento bilíngue

> Versão anônima de um projeto real. Os nomes e dados que aparecem na demo são fictícios.

## O desafio

Um casal ia se casar em Florianópolis, com convidados vindos de outros países. Eles precisavam de um lugar único para:

- informar data, local, dress code e como chegar, **em dois idiomas**;
- receber as **confirmações de presença** com acompanhantes e restrições alimentares, sem planilhas manuais nem mensagens perdidas no WhatsApp;
- ajudar quem vinha de fora com **hospedagem, passeios e dicas práticas** da cidade;
- receber **presentes por PIX**.

Havia três restrições: custo de manutenção zero, nada de login para os convidados e funcionamento perfeito no celular.

## A solução

### Para os convidados
- Navegação por telas (Início, História, Confirmação, Guia, Favoritos, Onde Ficar, Presentes), com transições e botões de "Anterior / Próximo".
- Troca de idioma com um toque, detectando o idioma do navegador na primeira visita.
- Formulário curto. Ao enviar, o convidado recebe um **e-mail de confirmação** com todos os detalhes do evento.
- Botões para salvar na agenda (Google e `.ics` para iPhone/Outlook).
- Guia da cidade com galeria de fotos, filtro por região, restaurantes e um mapa com todos os lugares.

### Para o casal
- Cada resposta entra no **Google Sheets** e gera um **e-mail de aviso**.
- Um **painel privado**, protegido por código, mostra totais, busca, filtros, exportação em CSV e um botão para copiar as restrições alimentares e mandar ao buffet.
- O formulário fecha sozinho na data limite.

## Arquitetura

- **Front-end:** HTML, CSS e JavaScript puros em um único arquivo, sem build. Fácil de manter e de entregar.
- **Back-end:** Google Apps Script publicado como Web App. Ele grava na planilha, envia os e-mails (MailApp) e serve os dados do painel. Não há servidor para manter.
- **Hospedagem:** Cloudflare Pages com domínio próprio, sem custo.
- **Integração:** o site envia as respostas por `fetch` em `no-cors` com `text/plain`, contornando as limitações de CORS do Apps Script. O painel lê os dados por `GET` com o código.

## Cuidados que fizeram diferença

- **Celular primeiro:** testes de 320 a 1440 px, áreas de toque ampliadas e campos que não dão zoom no iPhone.
- **Desempenho:** a ilustração foi convertida para WebP (de 640 KB para 154 KB) e as fotos usam carregamento sob demanda.
- **Segurança:** bloqueio por tentativas erradas no painel, campo anti-spam e proteção contra fórmulas injetadas na planilha.
- **Privacidade:** o site ficou fora do Google, os dados de contato dos donos de casas foram retirados do site, e um aviso no formulário explica como os dados são usados.
- **Detalhes de tipografia:** a fonte principal desenhava o acento circunflexo com defeito, e a correção foi trocar só os caracteres â/ê/ô por outra fonte.
- **Entrega completa:** QR code para o convite impresso, guia de uso do painel para o casal e instruções de manutenção.

## Resultado

Um site leve, bilíngue e sem custo de manutenção, entregue com:

- domínio próprio;
- confirmações chegando organizadas na planilha;
- e-mails automáticos para o casal e para os convidados;
- um painel que o casal usa sem depender de ninguém.

## Escopo

- Briefing com os clientes e proposta visual aprovada antes do desenvolvimento.
- Design das telas e organização do conteúdo nos dois idiomas.
- Desenvolvimento, integrações, painel e e-mails automáticos.
- Publicação com domínio próprio e entrega ao casal, com QR code e guia de uso.

## Tecnologias

HTML5, CSS3, JavaScript (vanilla), Google Apps Script, Google Sheets, MailApp, Cloudflare Pages, WebP, iCalendar (.ics) e PIX BR Code.
