const API_ROOT = 'https://world.openfoodfacts.org/api/v3/product'
const USER_AGENT = 'CUTPerformance/1.0 (https://github.com/kayzzer-code/Cutting_performance)'

export async function handler(event) {
  const barcodeFromPath = String(event.path ?? '').match(/(\d{8,14})\/?$/)?.[1]
  const barcode = String(event.queryStringParameters?.barcode ?? barcodeFromPath ?? '').replace(/\D/g, '')
  if (!/^\d{8,14}$/.test(barcode)) {
    return json(400, { error: 'invalid_barcode' })
  }

  const fields = String(event.queryStringParameters?.fields ?? 'code,product_name,brands,image_front_small_url,serving_size,quantity,product_quantity_unit,nutriments')
  const allowedFields = fields.split(',').filter((field) => /^[a-z0-9_-]+$/i.test(field)).join(',')
  try {
    const response = await fetch(`${API_ROOT}/${encodeURIComponent(barcode)}?fields=${encodeURIComponent(allowedFields)}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    })
    const body = await response.text()
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': response.ok ? 'public, max-age=3600, s-maxage=86400' : 'no-store',
      },
      body,
    }
  } catch {
    return json(503, { error: 'open_food_facts_unavailable' })
  }
}

function json(statusCode, value) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(value),
  }
}
