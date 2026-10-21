# 🗓️ Agenda Inteligente

App Android (React Native + Expo) para organizar tarefas da faculdade e do dia a dia: importa prazos do **Canvas da PUC Minas**, cria tarefas **por voz**, notifica no tempo que você escolher e toca **alarme** quando você quiser.

## O que ele faz

| # | Recurso | Como funciona |
|---|---------|---------------|
| 1 | Notificações das tarefas chegando | Tela **Próximas** (atrasadas, hoje, amanhã, 7 dias) + resumo diário às 07:30 |
| 2 | Várias tarefas por dia | Calendário mensal com pontinhos coloridos por importância |
| 3 | Horário das tarefas | Seletor de data e relógio nativos do Android; ou "dia inteiro" |
| 4 | Adicionar por áudio | 🎙️ fale "prova de SO sexta às 14h, urgente, me lembra uma semana e um dia antes" → o app reescreve e preenche tudo (offline, sem IA paga) |
| 5 | Emojis de importância | 🔥 Urgente · ⚡ Alta · ✨ Normal · 🌿 Baixa, e emoji da categoria (📝 prova, 📚 trabalho, 👥 reunião…) |
| 6 | Modo noturno | Botão 🌙 no topo ou Ajustes → Aparência (automático/claro/noturno) |
| 7 | Alarme opcional | ⏰ por tarefa, na hora ou X minutos antes; toca mesmo no "Não perturbe" |
| 8 | Status | ⏳ Pendente → 🚧 Em andamento → ✅ Concluída (toque no selo do cartão) |
| 9 | Notificações no celular | Agendadas no próprio Android: chegam com o app fechado |
| 10 | Notificar no tempo escolhido | 1 semana, 3 dias, 1 dia, 3 h, 1 h, 30 min, 15 min, na hora ou personalizado |

As notificações têm botões **✅ Concluir** e **😴 Adiar 10 min**.

## Instalar no celular (uma vez, pelo computador)

Pré-requisito: [Node.js](https://nodejs.org) 20.19 ou mais novo e uma conta grátis em [expo.dev](https://expo.dev).

```bash
cd agenda-inteligente
npm install          # instala o Expo
npm run setup        # instala as bibliotecas nas versões compatíveis com o SDK
npm install -g eas-cli
eas login
npm run apk          # gera o APK na nuvem da Expo (~10–15 min)
```

No fim, o terminal mostra um link/QR code. Abra no celular, baixe o `.apk` e instale (permita "instalar apps de fontes desconhecidas").

> Alternativa com Android Studio instalado: `npx expo run:android` com o celular ligado via USB.
> O Expo Go **não** serve aqui: o reconhecimento de voz precisa do APK próprio.

## Primeiro uso

1. **Ative as notificações** na tela de boas-vindas.
2. **Conecte o Canvas**: no navegador, Canvas → Calendário → "Feed do calendário" (canto inferior direito) → copie o link → Ajustes → cole → *Conectar e importar*.
   Também funciona com o "endereço secreto em formato iCal" do Google Agenda.
3. **Bateria**: Configurações do Android → Apps → Agenda Inteligente → Bateria → **Sem restrições** (Xiaomi/Samsung costumam atrasar avisos sem isso).
4. Em Ajustes, use **Testar lembrete** e **Testar alarme**.

## Como a sincronização funciona

- Busca o feed ao abrir o app (se passou 1 h) e a cada ~6 h em segundo plano.
- Título e data vêm do Canvas; status, importância, lembretes e alarme que **você** mudou são preservados.
- Tarefas novas do Canvas recebem os lembretes padrão (1 semana e 1 dia antes — mude em Ajustes).

## Frases que o áudio entende

- Datas: hoje, amanhã, depois de amanhã, sexta, próxima segunda, dia 30, 25/11, 5 de novembro, em 3 dias, semana que vem, fim de semana
- Horas: às 14h, 14:30, às 2 da tarde, 7 e meia da manhã, meio-dia, à noite
- Importância: urgente, importante, sem pressa
- Lembretes: "me lembra 1 semana antes e 1 dia antes", "avisa 2 horas antes", "na hora"
- Alarme: "com alarme", "alarme 30 minutos antes", "me acorda às 6h"

## Estrutura

```
App.tsx                  telas, barra inferior, toques nas notificações
index.ts                 entrada + tarefa de segundo plano
src/lib/                 lógica pura e testada (parser de voz, iCal, lembretes)
src/services/            notificações, Canvas, voz, armazenamento, seletores
src/components/          calendário, cartão, editor, adição rápida
src/screens/             Agenda, Próximas, Ajustes
tests/logica.test.ts     npm test
```

Dados ficam só no celular (AsyncStorage).
