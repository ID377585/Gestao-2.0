# Politica Inicial de Retencao

Esta politica e operacional e deve ser revisada juridicamente antes de uso
comercial amplo. Nunca apague dados de estabelecimento sem pedido formal,
registro de auditoria e backup validado.

| Dado | Retencao inicial | Observacao |
| --- | --- | --- |
| Auditoria de seguranca | 5 anos | Imutavel para usuarios comuns |
| Logs tecnicos sem dados sensiveis | 90 dias | Agregar metricas antes de expirar |
| Chaves de idempotencia | ate expirar + limpeza automatica | Nao contem segredo |
| Jobs concluidos | 7 a 30 dias | Jobs `dead` ficam ate triagem |
| Convites expirados/cancelados | 180 dias | Manter evidencia administrativa |
| Notificacoes | 180 dias | Permitir limpeza por tenant |
| XML/PDF fiscal | conforme obrigacao legal vigente | Revisao contábil obrigatoria |
| Certificados A1 | ate substituicao/expiracao | Armazenamento criptografado e restrito |
| Fotos comuns de usuario | enquanto conta ativa | Excluir em offboarding quando permitido |
| Biometria/foto facial | menor prazo possivel | Exige base legal, finalidade e alternativa |
| Dados de ponto | conforme politica trabalhista | Controle interno, nao REP oficial |
| Anexos operacionais | prazo definido por modulo | Bucket privado e URL assinada |

## Exclusao Segura

1. Confirmar solicitante e autoridade sobre o estabelecimento.
2. Classificar se a exclusao e permitida legalmente.
3. Exportar evidencias necessarias antes da remocao.
4. Executar exclusao por rotina server-side auditada.
5. Registrar ator, motivo, escopo e horario.

## Biometria

Biometria facial permanece bloqueada para uso comercial ate existir:

- base legal documentada;
- aviso/consentimento quando aplicavel;
- metodo alternativo sem biometria;
- bucket privado;
- URL assinada curta;
- auditoria de leitura;
- prazo de descarte;
- procedimento de contestacao;
- plano de resposta a incidente.
