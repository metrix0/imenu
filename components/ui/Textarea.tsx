"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
    function Textarea(props, ref) {
        return <textarea {...props} ref={ref} data-ui="textarea" />;
    }
);

export default Textarea;
