const response = await fetch("http://localhost:3000/matters/intake", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    matter_id: "matter-2026-014",
    client_name: "Northwind Legal",
    image_keys: ["evidence/site-photo.png", "evidence/scan-02.jpg"],
    signed_document_key: "signed/engagement-letter.pdf",
    deadline: "2026-09-15T09:00:00+08:00"
  })
});

console.log(JSON.stringify(await response.json(), null, 2));

export {};
