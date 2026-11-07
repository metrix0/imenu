import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from '@/lib/database/supabaseClient';
import { watchDevAccess, DEV_EMAIL } from '../access';
jest.mock('@/lib/database/supabaseClient',()=>({supabase:{auth:{getUser:jest.fn(),onAuthStateChange:jest.fn()}}}));
let emit:(event:string,session:unknown)=>void;
beforeEach(()=>{jest.useFakeTimers();jest.clearAllMocks();(supabase.auth.onAuthStateChange as jest.Mock).mockImplementation(f=>{emit=f;return{data:{subscription:{unsubscribe:jest.fn()}}}})});
afterEach(()=>jest.useRealTimers());
test.each([[null,'signed-out'],[{email:'other@example.com'},'forbidden'],[{email:DEV_EMAIL},'allowed']])('only verified admin can access dashboard',async(user,expected)=>{(supabase.auth.getUser as jest.Mock).mockResolvedValue({data:{user},error:null});const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();await Promise.resolve();expect(update).toHaveBeenLastCalledWith(expected);watch.unsubscribe()});
test('logout immediately locks access and invalidates pending verification',async()=>{let resolve!:(v:unknown)=>void;(supabase.auth.getUser as jest.Mock).mockReturnValue(new Promise(r=>resolve=r));const update=jest.fn(),watch=watchDevAccess(update);emit('SIGNED_OUT',null);resolve({data:{user:{email:DEV_EMAIL}},error:null});await Promise.resolve();await Promise.resolve();expect(update).toHaveBeenLastCalledWith('signed-out');watch.unsubscribe()});
test('auth verification stays outside the auth callback',async()=>{(supabase.auth.getUser as jest.Mock).mockResolvedValue({data:{user:{email:DEV_EMAIL}},error:null});const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();emit('TOKEN_REFRESHED',{access_token:'test'});expect(update).toHaveBeenLastCalledWith('checking');expect(supabase.auth.getUser).toHaveBeenCalledTimes(1);jest.runOnlyPendingTimers();await Promise.resolve();expect(update).toHaveBeenLastCalledWith('allowed');watch.unsubscribe()});

test.each(['SIGNED_IN', 'TOKEN_REFRESHED'])('same-admin %s keeps the dashboard mounted while revalidating',async event=>{
 const user={id:'admin',email:DEV_EMAIL};
 (supabase.auth.getUser as jest.Mock).mockResolvedValue({data:{user},error:null});
 const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();await Promise.resolve();update.mockClear();
 emit(event,{user});expect(update).not.toHaveBeenCalledWith('checking');
 jest.runOnlyPendingTimers();await Promise.resolve();expect(update).toHaveBeenLastCalledWith('allowed');watch.unsubscribe();
});

test('switching away from the verified admin locks the dashboard immediately',async()=>{
 (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({data:{user:{id:'admin',email:DEV_EMAIL}},error:null}).mockResolvedValue({data:{user:{id:'other',email:'other@example.com'}},error:null});
 const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();await Promise.resolve();
 emit('SIGNED_IN',{user:{id:'other',email:'other@example.com'}});expect(update).toHaveBeenLastCalledWith('checking');
 jest.runOnlyPendingTimers();await Promise.resolve();expect(update).toHaveBeenLastCalledWith('forbidden');watch.unsubscribe();
});

test('background verification still rejects an expired session',async()=>{
 const user={id:'admin',email:DEV_EMAIL};
 (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({data:{user},error:null}).mockResolvedValue({data:{user:null},error:new Error('Expired')});
 const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();await Promise.resolve();
 emit('TOKEN_REFRESHED',{user});jest.runOnlyPendingTimers();await Promise.resolve();expect(update).toHaveBeenLastCalledWith('signed-out');watch.unsubscribe();
});


test('temporary auth network failures do not unmount an already verified dashboard',async()=>{
 const user={id:'admin',email:DEV_EMAIL};
 (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({data:{user},error:null})
  .mockResolvedValueOnce({data:{user:null},error:new AuthRetryableFetchError('Failed to fetch',0)})
  .mockResolvedValueOnce({data:{user},error:null});
 const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();await Promise.resolve();update.mockClear();
 emit('SIGNED_IN',{user});jest.runOnlyPendingTimers();await Promise.resolve();await Promise.resolve();
 expect(update).not.toHaveBeenCalled();
 emit('TOKEN_REFRESHED',{user});jest.runOnlyPendingTimers();await Promise.resolve();await Promise.resolve();
 expect(update).toHaveBeenLastCalledWith('allowed');watch.unsubscribe();
});


test('an initial network error never grants dashboard access',async()=>{
 (supabase.auth.getUser as jest.Mock).mockResolvedValue({data:{user:null},error:new AuthRetryableFetchError('Offline',0)});
 const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();await Promise.resolve();
 expect(update).not.toHaveBeenCalledWith('allowed');expect(update).toHaveBeenLastCalledWith('signed-out');watch.unsubscribe();
});
test('switching accounts during a network failure cannot retain admin access',async()=>{
 (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({data:{user:{id:'admin',email:DEV_EMAIL}},error:null})
  .mockResolvedValueOnce({data:{user:null},error:new AuthRetryableFetchError('Offline',0)});
 const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();await Promise.resolve();update.mockClear();
 emit('SIGNED_IN',{user:{id:'other',email:'other@example.com'}});jest.runOnlyPendingTimers();await Promise.resolve();await Promise.resolve();
 expect(update).not.toHaveBeenCalledWith('allowed');expect(update).toHaveBeenLastCalledWith('signed-out');watch.unsubscribe();
});
test('a thrown retryable error also keeps the verified dashboard mounted',async()=>{
 const user={id:'admin',email:DEV_EMAIL};
 (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({data:{user},error:null}).mockRejectedValueOnce(new AuthRetryableFetchError('Offline',0));
 const update=jest.fn(),watch=watchDevAccess(update);await Promise.resolve();await Promise.resolve();update.mockClear();
 emit('TOKEN_REFRESHED',{user});jest.runOnlyPendingTimers();await Promise.resolve();await Promise.resolve();
 expect(update).not.toHaveBeenCalled();emit('SIGNED_OUT',null);expect(update).toHaveBeenLastCalledWith('signed-out');watch.unsubscribe();
});
