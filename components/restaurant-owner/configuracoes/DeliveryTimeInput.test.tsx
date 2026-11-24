import { useState, type ReactElement } from "react";
import DeliveryTimeInput from "./DeliveryTimeInput";
jest.mock("react", () => ({...jest.requireActual("react"), useState: jest.fn()}));
jest.mock("@/components/ui/Input", () => ({__esModule:true, default: () => null}));
jest.mock("@/components/ui/ConfirmModal", () => ({__esModule:true, default: () => null}));
const state = useState as jest.Mock;
function render(value: number, commit: jest.Mock, draft: string | null = null, pending: number | null = null) {
    const setDraft=jest.fn(), setPending=jest.fn();
    state.mockImplementationOnce(()=>[draft,setDraft]).mockImplementationOnce(()=>[pending,setPending]);
    const root=DeliveryTimeInput({value,onCommit:commit});
    const [field,modal]=root.props.children as ReactElement<any>[];
    return {field:field.props,modal:modal?.props,setDraft,setPending};
}
test("clamps oversized input immediately without committing",()=>{
    const commit=jest.fn(); const r=render(40,commit);
    r.field.onChange({target:{value:"999999999"}});
    expect(r.setDraft).toHaveBeenCalledWith("14400"); expect(commit).not.toHaveBeenCalled();
});
test.each([1,200])("commits %s without confirmation",minutes=>{
    const commit=jest.fn(); const r=render(40,commit,String(minutes)); r.field.onBlur();
    expect(commit).toHaveBeenCalledWith(minutes); expect(r.setPending).toHaveBeenCalledWith(null);
});
test.each([201,240,14400])("requires confirmation before committing %s",minutes=>{
    const commit=jest.fn(); const r=render(40,commit,String(minutes)); r.field.onBlur();
    expect(r.setPending).toHaveBeenCalledWith(minutes); expect(commit).not.toHaveBeenCalled();
    const pending=render(40,commit,String(minutes),minutes);
    pending.modal.onClose(); expect(pending.setDraft).toHaveBeenCalledWith(null); expect(commit).not.toHaveBeenCalled();
    pending.modal.onConfirm(); expect(commit).toHaveBeenCalledWith(minutes);
});
test("empty input clamps to one minute on blur",()=>{
    const commit=jest.fn(); render(40,commit,"").field.onBlur(); expect(commit).toHaveBeenCalledWith(1);
});
