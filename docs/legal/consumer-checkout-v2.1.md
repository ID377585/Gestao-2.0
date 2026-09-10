# Gestify — Checklist Consumerista e Checkout v2.1

Status: requisito de produto; não presume que checkout/billing já esteja implementado.

Quando o CDC for aplicável, o fluxo de contratação online deve, antes da confirmação, apresentar fornecedor e contatos, características essenciais do serviço, preço total/periodicidade/recorrência, restrições relevantes, resumo contratual e cláusulas limitativas em destaque; permitir correção de erros; exigir ação afirmativa de aceite; confirmar imediatamente a contratação; disponibilizar contrato/termos em formato conservável/reproduzível; registrar versão/data/autoridade do aceite.

## Arrependimento
Implementar fluxo para exercício do direito de arrependimento nas hipóteses do art. 49 do CDC, inclusive prazo legal aplicável, protocolo e tratamento do reembolso. Não criar renúncia antecipada genérica.

## Cancelamento
Exibir procedimento, data de efeito, impacto sobre acesso/dados, valores já pagos, reembolso quando devido e exportação/offboarding.

## Gate de lançamento
Não liberar cobrança recorrente para consumidor antes de validar interface, termos, confirmação, comprovante/contrato e fluxo de cancelamento/reembolso. O processador de pagamento deve ser identificado tecnicamente antes de qualquer declaração pública sobre dados de cartão.