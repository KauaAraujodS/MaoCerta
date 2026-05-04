/** Ícone decorativo por palavras-chave no nome da categoria (fallback genérico). */
export function iconeCategoria(nome: string): string {
  const n = nome.toLowerCase()
  if (/elétr|eletr|autom|alarme|câmera|camera|cerca|interfone|ventilador/i.test(n)) return '⚡'
  if (/hidr|encan|água|gesso|drywall|imperme|piso|revest|telhad|calha|forro|demoli/i.test(n)) return '🏗️'
  if (/pint|reforma|marcen|móvel|planejad|montagem|vidra|serralh|solda/i.test(n)) return '🔨'
  if (/limpe|dedet|lavagem|pós-obra|passad|organiz/i.test(n)) return '✨'
  if (/jardin|paisag/i.test(n)) return '🌿'
  if (/inform|ti |ti e|suporte|redes/i.test(n)) return '💻'
  if (/ar-cond|ar cond|climat/i.test(n)) return '❄️'
  if (/babá|cuidador|idoso|pet|banho e tosa/i.test(n)) return '👶'
  if (/personal|nutri|psico|masso|podol|cabele|barbear|manicur|sobrancelh/i.test(n)) return '💪'
  if (/foto|vídeo|video|design|marketing|tradução|aulas/i.test(n)) return '📷'
  if (/contab|advoc|juríd|consultoria jur/i.test(n)) return '📋'
  if (/moto|motor|frete|mudanç|entreg|logíst/i.test(n)) return '🚚'
  if (/chaveiro/i.test(n)) return '🔑'
  if (/buffet|cozinha|confeitar|bolo|cater/i.test(n)) return '🍰'
  if (/som|luz e evento|eventos/i.test(n)) return '🎵'
  if (/mecânica|estética auto/i.test(n)) return '🚗'
  if (/eletrodomést|conserto/i.test(n)) return '🔧'
  if (/costura|cortina/i.test(n)) return '🧵'
  return '🛠️'
}
