# Workflows — Meta Ads MCP

## 1. Crear campaña completa desde cero

### Paso 1: Obtener info previa
```
meta_get_ad_accounts()
→ Apunta el ad_account_id (sin "act_")

meta_get_account_pages(ad_account_id: "XXXXXXXXX")
→ Apunta el page_id de tu página de Facebook
```

### Paso 2: Subir imagen
```
meta_upload_ad_image(
  ad_account_id: "XXXXXXXXX",
  image_path: "C:/Users/jorge/Desktop/banner.jpg"
  // o image_url: "https://..."
)
→ Guarda el "hash" del resultado
```

### Paso 3: Crear creativo
```
meta_create_ad_creative(
  ad_account_id: "XXXXXXXXX",
  name: "Creativo - Banner Enero",
  page_id: "TU_PAGE_ID",
  message: "Texto principal del anuncio...",
  link: "https://photoheart.es/precios",
  image_hash: "HASH_DEL_PASO_2",
  title: "Titular del anuncio",
  description: "Descripción breve",
  call_to_action: "LEARN_MORE"
)
→ Guarda el "id" (creative_id)
```

### Paso 4: Crear campaña
```
meta_create_campaign(
  ad_account_id: "XXXXXXXXX",
  name: "PhotoHeart — Leads Enero 2025",
  objective: "OUTCOME_LEADS",
  status: "PAUSED",
  special_ad_categories: ["NONE"]
  // Si NO usas CBO (presupuesto va en ad set), el MCP añade
  // is_adset_budget_sharing_enabled: false automáticamente
)
→ Guarda el "id" (campaign_id)
```

### Paso 5: Buscar y validar targeting
```
meta_search_interests(query: "fotografía")
meta_search_geo_locations(query: "España", location_types: ["country"])
meta_estimate_audience_size(
  ad_account_id: "XXXXXXXXX",
  targeting_spec: {
    "geo_locations": { "countries": ["ES"] },
    "age_min": 25, "age_max": 55,
    "interests": [{ "id": "6003249025895", "name": "Photography" }]
  }
)
→ Confirmar que el tamaño es razonable (100K–5M)
```

### Paso 6: Crear ad set
```
meta_create_adset(
  ad_account_id: "XXXXXXXXX",
  campaign_id: "CAMPAIGN_ID",
  name: "España 25-55 Fotografía",
  optimization_goal: "LEAD_GENERATION",
  billing_event: "IMPRESSIONS",
  daily_budget: 2000,   ← 20€/día
  targeting: {
    "geo_locations": { "countries": ["ES"] },
    "age_min": 25, "age_max": 55,
    "interests": [{ "id": "6003249025895", "name": "Photography" }],
    "publisher_platforms": ["facebook", "instagram"],
    "facebook_positions": ["feed", "story"],
    "instagram_positions": ["stream", "story", "reels"]
  },
  status: "PAUSED"
)
→ Guarda el "id" (adset_id)
```

### Paso 7: Crear ad
```
meta_create_ad(
  ad_account_id: "XXXXXXXXX",
  adset_id: "ADSET_ID",
  name: "Ad — Banner Enero",
  creative_id: "CREATIVE_ID",
  status: "PAUSED"
)
```

### Paso 8: Revisar en Ads Manager y activar
Activar en orden: campaña → ad set → ad
```
meta_update_campaign(campaign_id: "...", status: "ACTIVE")
meta_update_adset(adset_id: "...", status: "ACTIVE")
meta_update_ad(ad_id: "...", status: "ACTIVE")
```

---

## 2. Analizar rendimiento

### Ver resumen de cuenta (último mes)
```
meta_get_insights(
  object_id: "XXXXXXXXX",   ← número de cuenta sin "act_"
  level: "campaign",
  date_preset: "last_30d",
  fields: "campaign_name,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type,roas"
)
```

### Comparar dos periodos
```
// Este mes
meta_get_insights(object_id: "...", date_preset: "this_month", level: "campaign", fields: "spend,clicks,ctr,actions")

// Mes anterior
meta_get_insights(object_id: "...", date_preset: "last_month", level: "campaign", fields: "spend,clicks,ctr,actions")
```

### Desglose por edad y género
```
meta_get_insights(
  object_id: "CAMPAIGN_ID",
  date_preset: "last_7d",
  breakdowns: "age,gender",
  fields: "spend,impressions,clicks,ctr,actions"
)
```

### Desglose por placement
```
meta_get_insights(
  object_id: "CAMPAIGN_ID",
  date_preset: "last_30d",
  breakdowns: "publisher_platform,platform_position",
  fields: "spend,impressions,clicks,ctr,cpc"
)
```

### Evolución diaria
```
meta_get_insights(
  object_id: "CAMPAIGN_ID",
  date_preset: "last_30d",
  time_increment: 1,    ← daily
  fields: "spend,impressions,clicks,actions"
)
```

### Bulk insights de varias campañas
```
meta_bulk_get_insights(
  object_ids: ["CAMP_1", "CAMP_2", "CAMP_3"],
  date_preset: "last_7d",
  fields: "spend,clicks,ctr,actions,cost_per_action_type"
)
```

---

## 3. Escalar campañas que funcionan

### Duplicar campaña ganadora
```
// 1. Ver qué campaña tiene mejor ROAS
meta_get_insights(object_id: "act_XXXXXXXXX", level: "campaign", date_preset: "last_30d", fields: "campaign_name,spend,roas,actions")

// 2. Duplicar
meta_duplicate_campaign(
  campaign_id: "GANADORA_ID",
  ad_account_id: "XXXXXXXXX",
  new_name: "PhotoHeart — Leads Feb [ESCALA]",
  status_override: "PAUSED"
)

// 3. Aumentar presupuesto en el duplicado (máx +20-30% para no resetear el aprendizaje)
meta_update_campaign(campaign_id: "NUEVA_ID", daily_budget: 5000)  ← 50€/día
```

### Pausar todo lo que no convierte
```
// Ver rendimiento por ad set
meta_get_insights(object_id: "CAMPAIGN_ID", level: "adset", date_preset: "last_14d", fields: "adset_name,spend,cost_per_action_type")

// Pausar los malos
meta_bulk_update_adsets(adset_ids: ["MALO_1", "MALO_2"], status: "PAUSED")
```

---

## 4. Gestión de audiencias

### Ver todas las audiencias disponibles
```
meta_get_custom_audiences(ad_account_id: "XXXXXXXXX")
```

### Crear audiencia de visitantes web (últimos 30 días)
```
meta_create_custom_audience(
  ad_account_id: "XXXXXXXXX",
  name: "Visitantes web 30d",
  pixel_id: "TU_PIXEL_ID",
  rule: "{\"inclusions\":{\"operator\":\"or\",\"rules\":[{\"event_sources\":[{\"id\":\"TU_PIXEL_ID\",\"type\":\"pixel\"}],\"retention_seconds\":2592000,\"filter\":{\"operator\":\"and\",\"filters\":[]}}]}}"
)
// Nota: No pasar "subtype" — v22.0 lo infiere del rule automáticamente
```

### Crear lookalike de compradores
```
// 1. Obtener ID de la audiencia de compradores
meta_get_custom_audiences(ad_account_id: "XXXXXXXXX")

// 2. Crear lookalike 1% en España
meta_create_lookalike_audience(
  ad_account_id: "XXXXXXXXX",
  name: "LAL 1% Compradores ES",
  source_audience_id: "AUDIENCE_COMPRADORES_ID",
  country: "ES",
  ratio: 0.01
)
```

---

## 5. Crear carousel

```
// 1. Subir imágenes (una por tarjeta)
meta_upload_ad_image(ad_account_id: "XXXXXXXXX", image_path: "C:/card1.jpg")  → hash1
meta_upload_ad_image(ad_account_id: "XXXXXXXXX", image_path: "C:/card2.jpg")  → hash2
meta_upload_ad_image(ad_account_id: "XXXXXXXXX", image_path: "C:/card3.jpg")  → hash3

// 2. Crear creativo carousel
meta_create_carousel_ad_creative(
  ad_account_id: "XXXXXXXXX",
  name: "Carousel Funcionalidades",
  page_id: "PAGE_ID",
  message: "PhotoHeart — Todo lo que necesitas para gestionar tu negocio de fotografía",
  cards: [
    { title: "Galerías online profesionales", link: "https://photoheart.es/galerias", image_hash: "hash1", call_to_action: "LEARN_MORE" },
    { title: "Contratos digitales", link: "https://photoheart.es/contratos", image_hash: "hash2" },
    { title: "Facturación automática", link: "https://photoheart.es/facturacion", image_hash: "hash3" }
  ],
  call_to_action: "LEARN_MORE"
)
```

---

## 6. Investigar targeting antes de crear

```
// Buscar intereses relacionados
meta_search_interests(query: "fotografía de bodas")
meta_search_interests(query: "photographer")
meta_search_interests(query: "wedding photography")

// Obtener sugerencias a partir de intereses encontrados
meta_get_interest_suggestions(interest_ids: ["ID_1", "ID_2"])

// Validar que los IDs son correctos antes de usarlos
meta_validate_interests(interest_ids: ["ID_1", "ID_2", "ID_3"])

// Buscar ubicaciones
meta_search_geo_locations(query: "Barcelona", location_types: ["city"])
meta_search_geo_locations(query: "Cataluña", location_types: ["region"])

// Estimar audiencia final
meta_estimate_audience_size(
  ad_account_id: "XXXXXXXXX",
  targeting_spec: {
    "geo_locations": { "countries": ["ES"] },
    "age_min": 28, "age_max": 50,
    "interests": [
      { "id": "ID_1", "name": "Photography" },
      { "id": "ID_2", "name": "Wedding Photography" }
    ]
  }
)
```

---

## Tips de rendimiento

### Cuándo usar cada optimization_goal

| Objetivo de campaña | optimization_goal recomendado | billing_event |
|---------------------|-------------------------------|---------------|
| Tráfico a web | `LINK_CLICKS` o `LANDING_PAGE_VIEWS` | `IMPRESSIONS` |
| Leads | `LEAD_GENERATION` | `IMPRESSIONS` |
| Ventas/conversiones | `OFFSITE_CONVERSIONS` | `IMPRESSIONS` |
| Reconocimiento | `REACH` o `IMPRESSIONS` | `IMPRESSIONS` |
| Vídeo | `VIDEO_VIEWS` o `THRUPLAY` | `IMPRESSIONS` |

### Bid strategies
- `LOWEST_COST_WITHOUT_CAP`: Meta optimiza libremente (más volumen, menos control de coste)
- `LOWEST_COST_WITH_BID_CAP`: Pones límite máximo de puja (menos volumen, más control)
- `COST_CAP`: Meta intenta no superar el coste por resultado que defines

### Fase de aprendizaje
- Necesita ~50 conversiones por ad set en 7 días para salir del aprendizaje
- No tocar presupuesto en más de un 20-30% de golpe o reinicia el aprendizaje
- Consolidar ad sets si hay muchos con poco gasto (menos de 5-10€/día cada uno)
