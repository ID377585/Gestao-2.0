# Gestify — SLA v2.1 (minuta controlada)

Status: **não contratual até aprovação jurídica e definição de SLO baseado em medição real**.

## Princípio
O Gestify não promete percentual de disponibilidade, RPO, RTO, crédito ou tempo de resolução sem evidência operacional suficiente. Esta minuta define o contrato de medição que deverá anteceder qualquer promessa comercial.

## Disponibilidade
Quando o SLO for aprovado, a disponibilidade mensal será calculada como `(minutos elegíveis - minutos de indisponibilidade elegível) / minutos elegíveis x 100`.

O Data Room deverá identificar a fonte de verdade da medição, período, endpoints/serviços cobertos, timezone e evidências históricas.

## Exclusões a revisar
Manutenção programada comunicada; falha causada por configuração/credencial/integração sob controle do cliente; eventos externos fora do controle razoável; indisponibilidade de terceiro somente na extensão juridicamente admissível. Exclusões nunca afastam responsabilidade inderrogável.

## Suporte
A versão final deverá definir severidades, canal, horário de cobertura, tempo de primeira resposta e escalonamento. Tempo de resposta não equivale a tempo garantido de resolução.

## DR
RPO/RTO só podem constar da versão contratual após testes reais de backup/restore e aprovação do valor medido.

## Remédios
Créditos de serviço e limites de responsabilidade somente serão definidos após validação comercial e jurídica. Não constituirão renúncia a direitos obrigatórios.

## Gate
Nenhum checkout, proposta ou contrato pode anunciar SLA numérico enquanto este documento estiver marcado como minuta controlada.