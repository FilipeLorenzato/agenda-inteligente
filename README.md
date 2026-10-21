<div align="center">

# 🗓️ Agenda Inteligente

**A agenda que organiza a faculdade sozinha.**
Puxa os prazos do Canvas da PUC Minas, cria tarefas por voz e te avisa no tempo que você escolher.

![Android](https://img.shields.io/badge/Android-app-3DDC84?logo=android&logoColor=white)
![React Native](https://img.shields.io/badge/React%20Native-Expo-6C4DF6?logo=expo&logoColor=white)
![Offline](https://img.shields.io/badge/dados-só%20no%20celular-2F9E6E)

<img src="docs/preview.png" alt="Telas da Agenda Inteligente: agenda, próximas, adição por voz e modo noturno" width="100%">

</div>

---

## 📲 Instalar no celular (sem computador)

1. No celular, abra a página **[Releases](../../releases/latest)** deste repositório.
2. Toque em **`AgendaInteligente.apk`** para baixar.
3. Abra o arquivo baixado e toque em **Instalar**.
   Se o Android pedir, permita **"Instalar apps desconhecidos"** para o navegador.
4. Pronto! Abra a **Agenda Inteligente** 🎉

> O repositório é privado, então você precisa estar logado no GitHub no navegador do celular para baixar.
> Cada nova versão do código gera um APK novo automaticamente. Para atualizar, é só baixar e instalar por cima — suas tarefas continuam lá.

---

## ✨ O que o app faz

| | Recurso | Como usar |
|---|---|---|
| 🎓 | **Tarefas do Canvas** | Conecte uma vez em *Ajustes* e os prazos entram sozinhos |
| 🎙️ | **Adicionar por voz** | Toque no microfone e fale. O app reescreve e preenche tudo |
| ➕ | **Adicionar digitando** | Botão *Nova*: escreva do seu jeito, ex. "lista de BD quinta 19h" |
| 🗓️ | **Calendário** | Várias tarefas por dia, com pontinhos coloridos por importância |
| 🕑 | **Horários** | Cada tarefa tem data e hora, ou "dia inteiro" |
| 🔥 | **Importância com emojis** | 🔥 Urgente · ⚡ Alta · ✨ Normal · 🌿 Baixa |
| ⏳ | **Status** | ⏳ Pendente → 🚧 Em andamento → ✅ Concluída (toque no selo do cartão) |
| 🔔 | **Notificações** | Chegam no celular mesmo com o app fechado |
| ⏱️ | **Avisar quando quiser** | 1 semana antes, 1 dia antes, 1 hora antes, na hora… ou o tempo que você escolher |
| ⏰ | **Alarme opcional** | Toca com som de alarme, mesmo no "Não perturbe" |
| 🌙 | **Modo noturno** | Botão 🌙 no topo da tela, ou automático pelo sistema |
| ☀️ | **Resumo do dia** | Toda manhã, uma notificação com as tarefas de hoje |

Nas notificações aparecem os botões **✅ Concluir** e **😴 Adiar 10 min**.

<img src="docs/preview-2.png" alt="Editor de tarefa, ajustes e tela de boas-vindas" width="100%">

---

## 🚀 Primeiros passos

### 1. Ative as notificações
Na tela de boas-vindas, toque em **Ativar notificações**. Sem isso o celular não consegue te avisar.

### 2. Conecte o Canvas
1. Abra o **Canvas pelo navegador** (no celular, use "Versão para computador" se precisar).
2. Vá em **Calendário**.
3. No canto inferior direito, toque em **Feed do calendário** e copie o link.
   Ele parece com `https://pucminas.instructure.com/feeds/calendars/user_….ics`
4. No app: **Ajustes → Conectar um calendário** → cole o link → **Conectar e importar**.

> Também funciona com o Google Agenda: em *Configurações → seu calendário → Endereço secreto em formato iCal*.

### 3. Deixe a bateria sem restrições
Para os avisos chegarem na hora certa:
**Configurações do Android → Apps → Agenda Inteligente → Bateria → Sem restrições.**
(Celulares Xiaomi, Samsung e Motorola costumam atrasar notificações sem isso.)

### 4. Teste
Em **Ajustes**, toque em **Testar lembrete** e **Testar alarme**. Eles chegam em 5 segundos.

---

## 🎙️ O que posso falar?

Fale naturalmente. Alguns exemplos:

- *"Prova de SO sexta às 14h, urgente, me lembra uma semana antes e um dia antes"*
- *"Entregar trabalho de PAA dia 30 às 23:59"*
- *"Dentista amanhã às 3 da tarde com alarme"*
- *"Academia às 7 e meia da manhã, alarme 30 minutos antes"*
- *"Estudar para a prova hoje à noite, sem pressa"*

| O app entende | Exemplos |
|---|---|
| **Datas** | hoje, amanhã, depois de amanhã, sexta, próxima segunda, dia 30, 25/11, 5 de novembro, em 3 dias, semana que vem, fim de semana |
| **Horas** | às 14h, 14:30, às 2 da tarde, 7 e meia da manhã, meio-dia, à noite |
| **Importância** | urgente, importante, sem pressa |
| **Lembretes** | "me lembra 1 semana antes e 1 dia antes", "avisa 2 horas antes", "na hora" |
| **Alarme** | "com alarme", "alarme 30 minutos antes", "me acorda às 6h" |

Antes de salvar, o app mostra **"Entendi assim"** para você conferir e ajustar. Tudo é processado no celular, sem enviar seus dados para nenhuma IA.

---

## ❓ Problemas comuns

<details>
<summary><b>Não recebo as notificações</b></summary>

- Confira se as notificações estão ativadas em *Ajustes* do app.
- Deixe a bateria do app em **Sem restrições** (passo 3 acima).
- Use **Testar lembrete** para verificar.
</details>

<details>
<summary><b>O microfone não entende o que eu falo</b></summary>

- O reconhecimento usa o app **Google** do celular. Mantenha-o atualizado.
- Para funcionar sem internet: app Google → Configurações → Voz → Reconhecimento de fala off-line → baixe **Português (Brasil)**.
- Você sempre pode digitar no campo abaixo do microfone.
</details>

<details>
<summary><b>O Canvas mostra "Link inválido ou expirado"</b></summary>

Copie o link do **Feed do calendário** de novo no Canvas e conecte outra vez. Remova o antigo com o ícone 🗑️.
</details>

<details>
<summary><b>Apaguei uma tarefa do Canvas e ela voltou</b></summary>

As tarefas importadas voltam na próxima sincronização. Em vez de excluir, marque como ✅ Concluída.
</details>

---

## 🔒 Privacidade

Suas tarefas ficam **só no seu celular**. O app só se conecta à internet para baixar o calendário do Canvas que você conectou.

---

## 🛠️ Para desenvolvedores

<details>
<summary><b>Como o APK é gerado</b></summary>

A cada `push` na branch `main`, o GitHub Actions ([`.github/workflows/build-apk.yml`](.github/workflows/build-apk.yml)):

1. instala as dependências compatíveis com o Expo SDK;
2. roda os testes da lógica;
3. gera o projeto Android (`expo prebuild`) e compila com Gradle;
4. publica o `AgendaInteligente.apk` em **Releases**.

Também dá para rodar manualmente em *Actions → Gerar APK → Run workflow*.
</details>

<details>
<summary><b>Rodar localmente</b></summary>

Precisa de Node.js 20.19+ e Android Studio.

```bash
npm install
npm run setup        # instala as bibliotecas nas versões do SDK
npm test             # testes da lógica
npm run android      # compila e abre no celular conectado por USB
```

O Expo Go não serve: o reconhecimento de voz precisa do app compilado.
</details>

<details>
<summary><b>Estrutura do projeto</b></summary>

```
App.tsx               telas, barra inferior e ações das notificações
index.ts              entrada do app + tarefa em segundo plano
src/
├── lib/              lógica pura e testada
│   ├── parser.ts     entende frases em português (voz/texto)
│   ├── ical.ts       lê o feed .ics do Canvas
│   └── logic.ts      importação, lembretes e resumo diário
├── services/         notificações, Canvas, voz, armazenamento
├── components/       calendário, cartão, editor, adição rápida
└── screens/          Agenda, Próximas, Ajustes
tests/                testes (npm test)
```

**Tecnologias:** React Native + Expo, expo-notifications (lembretes e alarmes exatos), expo-speech-recognition (voz em pt-BR no aparelho), expo-background-task (sincronização a cada ~6 h), AsyncStorage.
</details>
