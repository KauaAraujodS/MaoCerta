## Requisitos Funcionais - Prestador de Serviços

### Atendimentos
**RF-P01** – Acompanhamento de Atendimentos em Andamento  ###Kauã
O sistema deve permitir que o prestador acompanhe seus atendimentos em andamento, incluindo status, detalhes do serviço e informações do cliente.

### Carteira Financeira
**RF-P02** – Visualização de Carteira  ###Kauã
O sistema deve permitir que o prestador visualize o saldo disponível em sua carteira interna e o histórico completo de movimentações financeiras (créditos e débitos).

**RF-P03** – Solicitação de Saque  ###Kauã
O sistema deve permitir que o prestador solicite saque dos valores recebidos, com registro do status da solicitação (Pendente, Processado, Cancelado).

## Requisitos Funcionais - Cliente

**RF-C01** – Busca de Prestadores com Filtros  ###Kauã
O sistema deve permitir que o cliente busque prestadores utilizando filtros por categoria de serviço e localização (cidade/bairro), exibindo resultados ordenados por relevância, avaliação ou distância.

**RF-C02** – Visualização de Perfil do Prestador  ###Kauã
O sistema deve permitir que o cliente visualize o perfil completo de um prestador, incluindo:
- Informações pessoais (nome, foto, descrição)
- Reputação (nota média)
- Avaliações de outros clientes (comentários + nota)
- Status de verificação da conta
- Serviços oferecidos e valores

**RF-C03** – Contratação Direta de Prestador  ###Kauã
O sistema deve permitir que o cliente contrate um prestador diretamente pela plataforma, registrando um novo atendimento com status inicial "agendado", incluindo data, horário, endereço e valor combinado.