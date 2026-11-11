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
test('style lookup accepts only published images scoped to the restaurant', async () => {
 sql.mockResolvedValue({ rows: [] });
 expect(await approvedImageStyles('owner')).toEqual([]);
 expect(sql.mock.calls[0][0]).toContain("a.status='applied'");
 expect(sql.mock.calls[0][1]).toEqual(['owner']);
});
test('previously model-invented styles do not become shared owner preferences', async () => {
 sql.mockResolvedValueOnce({ rows: [
  { profile:'item',target_id:'sushi',applied_at:'2026-11-10',explicit_style:null,
    owner_message:'Gere uma foto deste prato',style:{background:'black',text:'Oferta'} },
 ] });
 expect(await approvedImageStyles('owner')).toEqual([]);
});
test('legacy style inherits only when the original owner request verifies it', async () => {
 sql.mockResolvedValueOnce({ rows: [
  {profile:'item',target_id:'sushi',applied_at:'2026-11-10',
   explicit_style:null,owner_message:'Gere com fundo branco e vista superior'},
 ] });
 const approved=await approvedImageStyles('owner');
 expect(approved).toEqual([{profile:'item',target_id:'sushi',applied_at:'2026-11-10',
  style:{background:'fundo branco',presentation:'vista de cima'}}]);
 expect(resolveImageStyle(approved,{target:'item'},'poke')).toEqual({
  background:'fundo branco',presentation:'vista de cima',
 });
});
test('explicit styles are persisted independently of inherited styles', async () => {
 sql.mockResolvedValueOnce({ rows: [
  {profile:'item',target_id:'sushi',applied_at:'2026-11-10',
   explicit_style:{background:'fundo claro',text:''},owner_message:null},
 ] });
 expect(await approvedImageStyles('owner')).toEqual([{
  profile:'item',target_id:'sushi',applied_at:'2026-11-10',
  style:{background:'fundo claro',text:''},
 }]);
});
test('new dishes share only visual choices, never ingredients or portions', () => {
 const approved=[
  {profile:'item',target_id:'sushi',applied_at:'2026-11-10',
   style:{background:'white',text:'',ingredients:'salmon',presentation:'30 pieces'}},
  {profile:'item',target_id:'burger',applied_at:'2026-11-09',
   style:{background:'black',text:'Sale',presentation:'ângulo de 45 graus'}},
 ];
 expect(resolveImageStyle(approved,{target:'item'},'poke')).toEqual({
  background:'white',text:'',presentation:'ângulo de 45 graus',
 });
 expect(resolveImageStyle(approved,{target:'item'},'sushi')).toEqual({
  background:'white',text:'',ingredients:'salmon',presentation:'30 pieces',
 });
 expect(resolveImageStyle(approved,{target:'item',style:{background:'beige',text:''}},'poke')).toEqual({
  background:'beige',text:'',presentation:'ângulo de 45 graus',
 });
 expect(resolveImageStyle([],{target:'item'},'poke')).toEqual({});
 expect(resolveImageStyle(approved,{target:'logo'},'owner')).toEqual({});
});
