import {renderToStaticMarkup} from 'react-dom/server';
import DevShell from './DevShell';
jest.mock('@/lib/database/supabaseClient',()=>({supabase:{auth:{}}}));
jest.mock('./dashboard.module.css',()=>({}));
jest.mock('./DevNavigation',()=>()=> <nav>Private navigation</nav>);
test('server render emits neither private content nor navigation before verification',()=>{const html=renderToStaticMarkup(<DevShell><div>Private dashboard data</div></DevShell>);expect(html).not.toContain('Private dashboard data');expect(html).not.toContain('Private navigation')});
