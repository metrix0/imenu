import { explicitlyTargetsImage, imageAllowed, approvedImageStyles, resolveImageStyle } from '../imagePolicy';
import { query } from '@/lib/database/sql';
jest.mock('@/lib/database/sql', () => ({ query: jest.fn() }));
const sql = query as jest.Mock;
beforeEach(() => sql.mockReset());
test.each([
 ['imagem para todos os combinados', 'Nº 1 - 30 unidades', false],
 ['colocar imagem em todos os produtos', 'Temaki', false],
 ['refaça a foto do Nº 1', 'Nº 1 - 30 unidades', true],
 ['número 02 igual', 'Nº 2 - 50 unidades', true],
 ['melhorar número 12', 'Nº 1 - 30 unidades', false],
 ['melhore a foto do Temaki Salmão', 'Temaki Salmão', true],
 ['não altere a foto do Temaki Salmão', 'Temaki Salmão', false],
 ['Refaça a foto do Temaki Salmão; não publique automaticamente', 'Temaki Salmão', true],
 ['Refaça a foto do Temaki Salmão, não publique', 'Temaki Salmão', true],
 ["Regenerate the photo of Temaki Salmão; don't publish automatically", 'Temaki Salmão', true],
 ['Não gere a foto do Temaki Salmão e não publique', 'Temaki Salmão', false],
 ['Não altere a foto do Temaki Salmão; não publique', 'Temaki Salmão', false],
 ['Refaça a foto do Temaki Atum; não publique', 'Temaki Salmão', false],
 ['Gere imagens para todos os produtos; não publique', 'Temaki Salmão', false],
 ['Não publique a foto do Temaki Salmão', 'Temaki Salmão', false],
 ['sim', 'Temaki Salmão', false],
 ['fundo branco', 'Temaki Salmão', false],
])('replacement intent: %s', (message,name,expected) => expect(explicitlyTargetsImage(message,name,'item')).toBe(expected));
test('applied images require the original source message, not a model flag or later batch approval', async () => {
 sql.mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [{ content: 'todos os combinados' }] });
 expect(await imageAllowed('owner','original-run',{ target:'item',item_id:'item',replace_existing:true },'Temaki')).toBe(false);
 expect(sql.mock.calls[1][1]).toEqual(['owner','original-run']);
 sql.mockResolvedValueOnce({ rows: [{}] }).mockResolvedValueOnce({ rows: [{ content: 'Refaça a foto do Temaki' }] });
 expect(await imageAllowed('owner','original-run',{ target:'item',item_id:'item' },'Temaki')).toBe(true);
});
test('new products need no regeneration permission', async () => {
 sql.mockResolvedValueOnce({ rows: [] });
 expect(await imageAllowed('owner','run',{ target:'item',item_id:'item' },'Temaki')).toBe(true);
 expect(sql).toHaveBeenCalledTimes(1);
});
test('style lookup accepts only applied images and remains scoped to the restaurant', async () => {
 sql.mockResolvedValue({ rows: [] }); await approvedImageStyles('owner');
 expect(sql.mock.calls[0][0]).toContain("status='applied'");
 expect(sql.mock.calls[0][1]).toEqual(['owner']);
});
test('new dishes inherit visual style without copying another dish ingredients or portion', () => {
 const approved=[{profile:'item',target_id:'sushi',applied_at:'2026-10-29',style:{background:'white',text:'Imagem ilustrativa',ingredients:'salmon',presentation:'30 pieces'}}];
 expect(resolveImageStyle(approved,{target:'item'},'poke')).toEqual({background:'white',text:'Imagem ilustrativa'});
 expect(resolveImageStyle(approved,{target:'item'},'sushi')).toEqual(approved[0].style);
 expect(resolveImageStyle(approved,{target:'item',style:{text:'',background:'black'}},'sushi')).toEqual({...approved[0].style,text:'',background:'black'});
 expect(resolveImageStyle(approved,{target:'logo'},'owner')).toEqual({});
});
