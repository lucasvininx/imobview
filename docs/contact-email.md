# Contato da ImobView

O Instagram oficial é [@imobview_](https://www.instagram.com/imobview_/).
O formulário de `/contato` envia as mensagens para `BUSINESS_EMAIL` usando o
mesmo transporte SMTP da recuperação de senha. O remetente é fixo e o endereço
do visitante entra apenas em `Reply-To`, para que a equipe possa responder.

## Configurar com Resend

Verifique o domínio de envio no Resend, gere uma chave de API com permissão de
envio e configure as variáveis **somente no servidor**, localmente e na Vercel:

```dotenv
SMTP_ENABLED=true
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=<chave de API do Resend>
SMTP_FROM=ImobView <endereco-no-dominio-verificado>
BUSINESS_EMAIL=<caixa de entrada que receberá os contatos>
```

Referência: [SMTP do Resend](https://resend.com/docs/send-with-smtp).
O Resend encaminha a mensagem para a caixa indicada; essa configuração não cria
uma caixa de e-mail. O formulário só aparece quando destinatário e SMTP estão
configurados. Enquanto isso, a página oferece atendimento pelo Instagram.

Após configurar, envie uma mensagem de teste por `/contato`, confirme o
recebimento e teste a resposta pelo e-mail informado no formulário. O envio
possui validação, consentimento, campo antispam e limite de três tentativas por
hora por origem. A confirmação aparece apenas após aceitação pelo SMTP.

Os contatos dos anúncios continuam sendo enviados à imobiliária responsável,
pelo cadastro de interesse, WhatsApp ou e-mail configurados por ela.
