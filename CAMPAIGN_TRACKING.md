# Campaign tracking activation

## What is already implemented

- First-touch and latest-touch campaign attribution is retained in the visitor's browser and submitted with every Growth Plan enquiry.
- The backend stores `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid`, `li_fat_id`, landing pages and referrer inside `data.attribution`.
- A successful Growth Plan submission emits the `generate_lead` event. No lead or form-field data is sent to GA4.
- Form engagement emits `growth_plan_form_start`; existing CTA, WhatsApp and phone click events remain available.

## Activate platform tags

Set the IDs in `src/_data/site.json` before deployment:

```json
"tracking": {
  "ga4MeasurementId": "G-7FXT005235",
  "gtmContainerId": "GTM-XXXXXXX",
  "metaPixelId": "123456789012345",
  "linkedInPartnerId": "123456"
}
```

Use Google Tag Manager to fire Google Ads and LinkedIn conversion events from the `generate_lead` data-layer event. Configure Meta browser `Lead` tracking from the same successful event. Meta Conversions API should be enabled later with `META_PIXEL_ID` and `META_CONVERSIONS_API_TOKEN` in the backend environment; never put that token in this repository or browser code.

## Campaign URL convention

Use lowercase, hyphenated values. Example:

```text
https://scratchbox.media/industries/saas-technology/?utm_source=linkedin&utm_medium=paid-social&utm_campaign=saas-growth-plan&utm_content=founder-video-01
```

Required for every paid URL: `utm_source`, `utm_medium`, `utm_campaign`.

Recommended values:

| Field | Examples |
| --- | --- |
| `utm_source` | `google`, `meta`, `linkedin` |
| `utm_medium` | `paid-search`, `paid-social`, `remarketing` |
| `utm_campaign` | `saas-growth-plan`, `d2c-demand-engine` |
| `utm_content` | `founder-video-01`, `carousel-02`, `search-ad-a` |

## Platform configuration

- **GA4:** mark `generate_lead` as a key event; register `lead_source`, `industry`, `objective` and `page_type` as custom dimensions if reporting needs them.
- **Google Ads:** link the GA4 property to the Ads account, create/import the `generate_lead` conversion, and enable Conversion Linker in GTM.
- **Meta:** verify `scratchbox.media` in Business Manager; use browser Pixel immediately and add Conversions API once server credentials are available.
- **LinkedIn:** install the Insight Tag and create a website conversion triggered by `generate_lead`.

## QA checklist

1. Open a tagged URL in an incognito browser.
2. Complete a test Growth Plan form.
3. Confirm the saved submission has the expected first/latest touch values.
4. Confirm one `generate_lead` event in GA4 DebugView, Google Tag Assistant, Meta Test Events and LinkedIn Campaign Manager.
5. Remove or label the test submission before reporting on live leads.
