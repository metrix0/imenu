import { renderToStaticMarkup } from 'react-dom/server';
import AiUsage from '@/components/restaurant-owner/ia-vendas/AiUsage';
import type { aiAccess } from '../access';
import { LIMITS } from '../config';
const access = (plus: boolean, tokens: number, images: number): Awaited<ReturnType<typeof aiAccess>> => ({
 plus, free_applications_remaining:null, reserved_tokens:0, tokens_remaining:null, images_remaining:0,
 usage: { tokens:{input:tokens*20000,output:0,input_limit:2000000,output_limit:120000,percent:tokens},images:{used:images*LIMITS.images/100,limit:LIMITS.images,percent:images} },
});
test.each([[false,100,100],[true,69.99,69.99]])('hidden for free users and below threshold', (plus,tokens,images) => {
 expect(renderToStaticMarkup(<AiUsage access={access(plus,tokens,images)} />)).toBe('');
});
test.each([[70,0],[0,70],[100,100]])('either resource at 70%% reveals both bars', (tokens,images) => {
 const html=renderToStaticMarkup(<AiUsage access={access(true,tokens,images)} />);
 expect(html.match(/role="progressbar"/g)).toHaveLength(2);
 expect(html).toContain('Tokens'); expect(html).toContain('Imagens'); expect(html).toContain('75 imagens');
});
test('collapsed sidebar keeps both accessible resource names', () => {
 const html=renderToStaticMarkup(<AiUsage compact access={access(true,80,10)} />);
 expect(html).toContain('aria-label="Tokens:'); expect(html).toContain('aria-label="Imagens:');
});
