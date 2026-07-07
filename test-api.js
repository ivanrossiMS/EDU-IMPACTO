import fs from 'fs';

async function test() {
  const base64Data = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCgkvRjIgNSAwIFIKICAgID4+CiAgPj4KICAvQ29udGVudHMgNiAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8CiAgL1R5cGUgL0ZvbnQKICAvU3VidHlwZSAvVHlwZTEKICAvQmFzZUZvbnQgL1RpbWVzLVJvbWFuCj4+CmVuZG9iagoKNSAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCgo2IDAgb2JqCjw8CiAgL0xlbmd0aCA3MwovRmlsdGVyIC9GbGF0ZURlY29kZQo+PgpzdHJlYW0KeJwr5HIK4dJ3M1QwNVAISeFyDeEK5CpUMFSAcwx1FIwNFcIhzEAhc0Mgc4hTKMQOADhACkYKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjggMDAwMDAgbiAKMDAwMDAwMDE2NyAwMDAwMCBuIAowMDAwMDAwMzE0IDAwMDAwIG4gCjAwMDAwMDA0MDUgMDAwMDAgbiAKMDAwMDAwMDQ5MyAwMDAwMCBuIAp0cmFpbGVyCjw8CiAgL1NpemUgNwogIC9Sb290IDEgMCBSCj4+CnN0YXJ0eHJlZgo2MjEKJSVFT0YK";
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync('dummy.pdf', buffer);
  
  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'application/pdf' }), 'dummy.pdf');
  
  const res = await fetch('http://localhost:3000/api/boletins/extrair-pdf', {
    method: 'POST',
    body: formData
  });
  
  const json = await res.json();
  console.log("RESPONSE:", json);
}
test();
