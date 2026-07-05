// Проверка чистой математики корзины (суммы/вес/надбавка).
// Запуск: node --env-file=.env.local --import tsx scripts/orders/verify-math.ts
import { lineSum, qtyText } from "../../src/app/menu/cart";

let ok = 0;
let fail = 0;
function check(label: string, cond: boolean) {
  console.log(`  [${cond ? "OK" : "FAIL"}] ${label}`);
  if (cond) ok++;
  else fail++;
}

console.log("=== СУММА СТРОКИ (lineSum) ===");
check("фикс: 650 × 2 = 1300", lineSum({ unitPrice: 650, qty: 2 }) === 1300);
check("вес: 9000/кг × 1,5 = 13500", lineSum({ unitPrice: 9000, qty: 1.5 }) === 13500);
check("вес: 2900/кг × 0,5 = 1450", lineSum({ unitPrice: 2900, qty: 0.5 }) === 1450);
check("раки+надбавка: 5900×1,5 + 1000 = 9850", lineSum({ unitPrice: 5900, qty: 1.5, extra: 1000 }) === 9850);
check("раки XL+пиво 2кг: 6700×2 + 1000 = 14400", lineSum({ unitPrice: 6700, qty: 2, extra: 1000 }) === 14400);
check("надбавка НЕ множится на вес (флэт)", lineSum({ unitPrice: 5900, qty: 3, extra: 1000 }) === 5900 * 3 + 1000);
check("округление дробной: 333×0,5 = 167 (round)", lineSum({ unitPrice: 333, qty: 0.5 }) === Math.round(166.5));

console.log("\n=== ПОДПИСЬ КОЛИЧЕСТВА (qtyText) ===");
check("штуки: ×2", qtyText({ unit: "шт", qty: 2 }) === "×2");
check("кг целое: 1 кг", qtyText({ unit: "кг", qty: 1 }) === "1 кг");
check("кг дробное с запятой: 1,5 кг", qtyText({ unit: "кг", qty: 1.5 }) === "1,5 кг");
check("кг 2,5: 2,5 кг", qtyText({ unit: "кг", qty: 2.5 }) === "2,5 кг");

console.log("\n=== ПАРСИНГ НАДБАВКИ РЕЦЕПТА ===");
const parseSur = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
check("«+1 000 ₽» → 1000 (узкий пробел)", parseSur("+1 000 ₽") === 1000);
check("«+1 000 ₽» обычный пробел → 1000", parseSur("+1 000 ₽") === 1000);
check("без надбавки → 0", parseSur("") === 0);

console.log(`\nИТОГ: OK ${ok}, FAIL ${fail}`);
process.exitCode = fail ? 1 : 0;
