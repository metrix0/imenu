import { renderToStaticMarkup } from 'react-dom/server';
import AiUsage from '@/components/restaurant-owner/ia-vendas/AiUsage';
import { AssistantQuotaReply } from '@/components/restaurant-owner/ia-vendas/ErrorNoticeContent';
import { formatAiResetAt } from '../usageReset';
import type { aiAccess } from '../access';
import { LIMITS } from '../config';

const resetAt = '2026-12-01T00:00:00.000Z';
const access = (plus: boolean, tokens: number, images: number): Awaited<ReturnType<typeof aiAccess>> => ({
 plus, free_applications_remaining:plus ? null : 1, reserved_tokens:0,
 purchased_credits: { input:0, output:0, images:0 }, base_tokens_remaining: plus ? null : 150000, base_images_remaining:plus ? 75 : 3,
 tokens_remaining:plus ? null : Math.max(0, 150000 - tokens * 1500),
 images_remaining:plus ? Math.max(0, LIMITS.images - images * LIMITS.images/100) : Math.max(0, 3 - images * 3/100),
 free_tokens_limit:plus ? null : 150000, free_images_limit:plus ? null : 3,
 tokens_reset_at:resetAt, images_reset_at:resetAt,
 usage: plus ? { tokens:{input:tokens*20000,output:0,input_limit:2000000,output_limit:120000,percent:tokens},images:{used:images*LIMITS.images/100,limit:LIMITS.images,percent:images} } : null,
});
test.each([[false,0,0],[true,69.99,69.99]])('hidden below threshold', (plus,tokens,images) => {
 expect(renderToStaticMarkup(<AiUsage access={access(plus,tokens,images)} />)).toBe('');
});
test.each([[70,0],[0,70],[100,100]])('either Plus resource at 70%% reveals both bars', (tokens,images) => {
 const html=renderToStaticMarkup(<AiUsage access={access(true,tokens,images)} />);
 expect(html.match(/role="progressbar"/g)).toHaveLength(2);
 expect(html).toContain('Limite'); expect(html).toContain('Imagens'); expect(html).toContain('75 imagens');
});
test('collapsed sidebar keeps both accessible resource names', () => {
 const html=renderToStaticMarkup(<AiUsage compact access={access(true,80,10)} />);
 expect(html).toContain('aria-label="Limite:'); expect(html).toContain('aria-label="Imagens:');
});
test('shows exact token and image usage counts with information controls', () => {
 const html = renderToStaticMarkup(<AiUsage access={access(true,90,93.33333333333333)} />);
 expect(html).toContain('Entrada: 1.800.000 / 2.000.000');
 expect(html).toContain('Saída: 0 / 120.000');
 expect(html).toContain('70 / 75 imagens');
 expect(html).toContain('aria-label="Informações de uso de Limite"');
 expect(html).toContain('aria-label="Informações de uso de Imagens"');
});
test('info icon comes after percent; exact numbers stay inside info tooltip', () => {
 const html = renderToStaticMarkup(<AiUsage access={access(true,90,93.33333333333333)} />);
 const tokenHeader = html.slice(html.indexOf('aria-label="Limite"'), html.indexOf('role="progressbar"'));
 expect(tokenHeader.indexOf('90%')).toBeGreaterThan(-1);
 expect(tokenHeader.indexOf('90%')).toBeLessThan(tokenHeader.indexOf('aria-label="Informações de uso de Limite"'));
 expect(html).toContain('Entrada: 1.800.000 / 2.000.000');
 expect(html).toContain('70 / 75 imagens');
});
test('100% Plus usage shows exact reset and buy-more button, without upsell CTA', () => {
 const html=renderToStaticMarkup(<AiUsage access={access(true,100,93)} onBuyTokens={() => {}} />);
 expect(html).toContain('Limites serão reiniciados em 30/11 às 21:00.');
 expect(html).toContain('Recarregar créditos');
 expect(html).not.toContain('Assinar iMenu Plus');
 expect(html.indexOf('Limites serão reiniciados')).toBeLessThan(html.indexOf('aria-label="Limite"'));
});
test('free usage only appears near its cap and shows the rolling reset', () => {
 const html=renderToStaticMarkup(<AiUsage access={access(false,100,0)} onBuyTokens={() => {}} />);
 expect(html).toContain('Uso gratuito de IA');
 expect(html).toContain('Limites serão reiniciados em');
 expect(html).toContain('Recarregar créditos');
});
test('reset formatting is timezone-aware and invalid dates are omitted', () => {
 expect(formatAiResetAt(resetAt)).toBe('30/11 às 21:00');
 expect(formatAiResetAt(null)).toBeNull();
 expect(formatAiResetAt('not-a-date')).toBeNull();
});

test('monthly quota explains when a partial token balance cannot cover the next request', () => {
 const value = access(true, 98, 10);
 const html = renderToStaticMarkup(
   <AssistantQuotaReply
     message="Limite mensal de IA atingido. Limites serão reiniciados em 30/11 às 21:00."
     access={value}
     onBuyCredits={() => {}}
   />,
 );
 expect(html).toContain("O saldo restante não é suficiente");
 expect(html).toContain("Recarregar créditos");
});

test('quota message keeps the existing usage rows with only two inline bars', () => {
 const value = access(true, 98, 100);
 const html = renderToStaticMarkup(
   <AssistantQuotaReply
     message="Limite mensal de IA atingido. Limites serão reiniciados em 30/11 às 21:00."
     access={value}
     onBuyCredits={() => {}}
   />,
 );
 expect(html.match(/role="progressbar"/g)).toHaveLength(2);
 expect(html).toContain('aria-label="Uso de tokens de entrada"');
 expect(html).toContain('aria-label="Uso de imagens"');
 expect(html).not.toContain('Tokens de saída');
 expect(html).toContain('aria-valuenow="98"');
 expect(html).toContain('aria-valuenow="100"');
 expect(html.indexOf('Tokens de entrada')).toBeLessThan(html.indexOf('aria-label="Uso de tokens de entrada"'));
 expect(html.indexOf('aria-label="Uso de tokens de entrada"')).toBeLessThan(html.indexOf('Tokens de saída'));
 expect(html.indexOf('<dt>Imagens</dt>')).toBeLessThan(html.indexOf('aria-label="Uso de imagens"'));
 expect(html).not.toContain('aria-label="Informações de uso');
 expect(html.match(/Recarregar créditos/g)).toHaveLength(1);
 expect(html.match(/Limites serão reiniciados em/g)).toHaveLength(1);
});

test('monthly quota notice explains the exact plan limits and current usage', () => {
 const value = access(true, 100, 93.33333333333333);
 value.usage!.tokens.output = 29;
 const html = renderToStaticMarkup(
   <AssistantQuotaReply
     message="Limite mensal de IA atingido. Limites serão reiniciados em 30/11 às 21:00."
     access={value}
     onBuyCredits={() => {}}
   />,
 );
 expect(html).toContain("Seu plano inclui estes limites mensais.");
 expect(html).toContain("2.000.000 / 2.000.000");
 expect(html).not.toContain("29 / 120.000");
 expect(html).not.toContain("Tokens de saída");
 expect(html).toContain("70 / 75");
 expect(html).toContain("30/11 às 21:00");
 expect(html).toContain("Recarregar créditos");
});
