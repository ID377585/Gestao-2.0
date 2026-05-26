# Notificações, clima no topo e contagem de estoque

Este guia descreve os recursos adicionados ao topo do sistema e ao módulo de notificações.

## Data e clima no topo

O `Topbar` exibe, entre o status do plano e o sino de notificações, um bloco com data e clima.

Exemplos:

- Tela grande: `Ter: 26/05 — 29ºC ☀️`
- Tela muito grande: `Terça-feira: 26 de Maio 2026 — 29ºC ☀️`

### Como o clima é buscado

1. O componente chama a rota interna:

```text
/api/weather/current
```

2. A rota tenta obter a localização da empresa ativa usando os dados fiscais cadastrados, priorizando:
   - município;
   - UF;
   - endereço/logradouro;
   - bairro;
   - CEP.

3. A localização textual é geocodificada pela API da Open-Meteo.
4. A temperatura atual é carregada pela Open-Meteo.
5. Se a empresa não tiver dados suficientes, o frontend tenta usar a localização do navegador como fallback.
6. Se nada funcionar, o topo exibe apenas o fallback de clima indisponível.

### Atualização

- A data é atualizada a cada 1 minuto.
- O clima é atualizado a cada 15 minutos.

### Observações

- A localização do navegador é opcional e depende de permissão do usuário.
- A localização principal deve ser a da empresa/unidade ativa.
- O componente fica compacto para não quebrar o layout do topo.

## Contagem de estoque nas notificações

O sistema exibe uma contagem regressiva no modal de notificações quando faltar 3 dias para o último dia do mês.

Formato:

```text
Dias - HH:MM:SS
```

Exemplo:

```text
2 dias - 05:14:33
```

No último dia do mês, a mensagem orienta que os usuários façam a contagem de estoque nos horários:

- 06:00
- 15:00
- 21:00

## Notificações automáticas da contagem de estoque

Foi criada a rota:

```text
/api/notifications/stock-count-reminders
```

Ela cria uma notificação crítica quando for:

- último dia do mês;
- 06:00, 15:00 ou 21:00;
- dentro da janela de tolerância de até 10 minutos.

A notificação criada é do tipo:

```text
stock_count_reminder
```

E possui prioridade:

```text
critical
```

## Som da notificação

O som utiliza o mecanismo existente do `Topbar`.

Quando uma nova notificação crítica chega para o usuário e o som está ativado nas preferências, o sistema toca o alerta sonoro.

Para funcionar no navegador:

- o usuário precisa estar logado;
- o sistema precisa estar aberto;
- as preferências de som precisam estar ativadas;
- o navegador não pode estar bloqueando reprodução de áudio.

## Cron da Vercel

O `vercel.json` agenda a rota de contagem de estoque a cada 10 minutos:

```text
*/10 * * * *
```

A rota roda frequentemente, mas só cria notificação nos horários válidos.

## Checklist de teste após deploy

1. Confirmar que o deploy da Vercel ficou como `Ready`.
2. Abrir o sistema em tela grande e verificar se aparece data/clima entre o plano e o sino.
3. Passar o mouse sobre o bloco de clima e conferir se aparece localização/condição no tooltip.
4. Abrir o sino de notificações.
5. Clicar em `Ver todas`.
6. Na janela de 3 dias antes do fim do mês, confirmar a contagem regressiva.
7. No último dia do mês, verificar se as notificações críticas aparecem às 06:00, 15:00 e 21:00.
8. Confirmar se o som toca quando chegar nova notificação crítica.

## Limitações conhecidas

- A contagem regressiva só aparece na janela dos últimos 3 dias antes do último dia do mês.
- A notificação automática depende do cron da Vercel em produção.
- Clima em tempo real depende da disponibilidade da Open-Meteo.
- Se o cadastro fiscal da empresa não tiver cidade/UF/endereço suficiente, o sistema pode usar fallback do navegador ou exibir clima indisponível.
