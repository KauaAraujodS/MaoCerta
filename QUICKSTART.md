# ⚡ QUICKSTART: RF30-RF38 em 5 Minutos

## 🚀 Comece Aqui

### Passo 1: Aplicar Migration (1 min)
```
1. Abra https://supabase.com/dashboard
2. Vá para SQL Editor
3. Clique "New query"
4. Copie de: supabase/migrations/018_etapas_atendimento.sql
5. Cole no editor
6. Clique "Run"
```

✅ Pronto! Tabelas criadas.

---

### Passo 2: Entender a Estrutura (2 min)

**O que foi criado:**
```
📁 Banco de Dados
  └─ 4 tabelas novas + 3 enums + triggers

📁 src/types/
  └─ 6 tipos novos para TypeScript

📁 src/lib/supabase/
  └─ 16 funções novas no prestadorService

📁 src/components/etapas/
  └─ 4 componentes React novos

📁 src/screens/profissional/
  └─ Tela atualizada com etapas
```

---

### Passo 3: Testar (2 min)

#### No Terminal:
```bash
npm run dev
```

#### No Browser:
1. Faça login como **profissional**
2. Aceite uma demanda
3. Abra o atendimento
4. Veja a nova seção "📋 Etapas do Atendimento"
5. Clique em um card para expandir

✅ Tudo funcionando!

---

## 📚 Próximas Leituras (por prioridade)

1. **CHECKLIST-RF30-RF38.md** - Resumo executivo (5 min)
2. **docs/rf30-rf38-implementacao.md** - Guia técnico (15 min)
3. **docs/exemplos-uso-etapas.md** - Como usar (10 min)
4. **ESTRUTURA-IMPLEMENTACAO.md** - Estrutura do código (5 min)

---

## 🎯 O Que Cada Requisito Faz

| RF | O Quê | Como Usar |
|-------|--------|-----------|
| **RF30** | Organiza em etapas | Automático ao aceitar demanda |
| **RF31** | Vistoria/Consulta | 1ª etapa - propor data |
| **RF32** | Orçamento | 2ª etapa - propor data |
| **RF33** | Execução | 3ª etapa - propor data |
| **RF34** | Confirmar conclusão | Ambos clicam "🤝 Confirmar" |
| **RF36** | Propor data/hora | Botão "📅 Propor Data/Horário" |
| **RF37** | Aceite mútuo | Aceitar proposta em "Respostas" |
| **RF38** | Cancelar com motivo | Botão "❌ Cancelar Etapa" + motivo |

---

## 🧪 Teste Rápido (2 min)

### Cenário: Profissional faz uma vistoria
```
1. Login como profissional
2. Ir para "Demandas"
3. Aceitar uma demanda
4. Abrir o atendimento
5. Ver seção "Etapas"
   └─ 3 cards: Vistoria, Orçamento, Execução

6. Expandir card "🔍 Vistoria/Consulta"
   └─ Botão "📅 Propor Data/Horário"

7. Clicar no botão
   └─ Modal abre com date + time inputs

8. Escolher:
   └─ Data: amanhã
   └─ Horário: 14:00

9. Clicar "📤 Enviar Proposta"
   └─ Proposta criada (status: proposto_prestador)

10. Na aba "Respostas":
    └─ Ver proposta com status "⏳ Aguardando resposta"

11. Fechar modal - voltar ao card
    └─ Card agora mostra a data proposta
```

✅ Fluxo funcionando!

---

## 🐛 Se Algo Não Funcionar

### Erro 1: "Etapas não aparecem"
```
❌ Causa: Migration não foi aplicada
✅ Solução: Rode a migration de novo
```

### Erro 2: "Botão de propor não aparece"
```
❌ Causa: Você é cliente, não prestador
✅ Solução: Use conta de profissional
```

### Erro 3: "Modal fica em branco"
```
❌ Causa: Console error (F12)
✅ Solução: Abra DevTools → Console e veja o erro
```

### Erro 4: "Não pode confirmar"
```
❌ Causa: Etapa não está em "concluida"
✅ Solução: Marcar como concluída primeiro
```

---

## 💡 Dicas Importantes

1. **Etapas são criadas automaticamente** quando você aceita uma demanda
2. **Só prestador pode propor data** - cliente aceita/rejeita
3. **Ambos precisam confirmar** - sem confirmação mútua, fica "pendente"
4. **Cancelamento registra motivo** - para auditoria
5. **Cada etapa é independente** - pode ter diferentes datas

---

## 🎨 Customizações Rápidas

### Mudar nome da etapa:
```tsx
// src/components/etapas/CardEtapa.tsx
const nomeEtapaMap = {
  vistoria: { nome: "Seu novo nome", emoji: "🔍" },
  // ...
}
```

### Mudar cores:
```tsx
const statusBadges = {
  pendente: { bg: 'bg-gray-50', text: 'text-gray-700' },
  // Mudar cores aqui
}
```

### Adicionar nova etapa:
```sql
-- Em supabase/migrations/018_etapas_atendimento.sql
ALTER TYPE tipo_etapa ADD VALUE 'nova_etapa';

INSERT INTO etapas_tipos (tipo, nome, sequencia)
VALUES ('nova_etapa', 'Nome da Nova Etapa', 4);
```

---

## 📞 FAQ Rápido

**P: Posso ter mais de 3 etapas?**
A: Sim! Adicione no enum `tipo_etapa` e na tabela `etapas_tipos`

**P: Pode deletar uma etapa?**
A: Não precisa - cancele com motivo (RF38)

**P: Funciona offline?**
A: Não - precisa de conexão com Supabase

**P: Qual é o tamanho do motivo de cancelamento?**
A: Campo `text` - pode ser bem grande

**P: Posso reeditar uma etapa concluída?**
A: Não - está "locked" para edição

---

## ✅ Conclusão

**Você está pronto!**

- ✅ Migration aplicada
- ✅ Componentes prontos
- ✅ Tudo funcionando
- ✅ Documentação completa

**Próximo passo:** Ler `CHECKLIST-RF30-RF38.md` para resumo executivo

---

**Tempo total:** 5 minutos ⏱️

Bora codar! 🚀
