/** The byte layout of the one-page PDF produced when a menu photo is uploaded. */
export function menuPhotoPdfParts(width: number, height: number, jpegLength: number) {
    const scale = 1000 / Math.max(width, height);
    const pageWidth = Math.max(1, width * scale).toFixed(3);
    const pageHeight = Math.max(1, height * scale).toFixed(3);
    const contentStream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    const header = "%PDF-1.4\n";
    const catalog = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    const pages = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    const page = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
    const image = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegLength} >>\nstream\n`;
    const endImage = "\nendstream\nendobj\n";
    const contents = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`;

    const before = header + catalog + pages + page + image;
    const contentsOffset = before.length + jpegLength + endImage.length;
    const offsets = [
        header.length,
        header.length + catalog.length,
        header.length + catalog.length + pages.length,
        before.length - image.length,
        contentsOffset,
    ];
    const xref = `xref\n0 6\n0000000000 65535 f \n${offsets
        .map(offset => `${String(offset).padStart(10, "0")} 00000 n `)
        .join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${contentsOffset + contents.length}\n%%EOF\n`;
    return { before, after: endImage + contents + xref };
}
