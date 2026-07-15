-- Migration 017: Add tkt.ge as event source
-- tkt.ge is Georgia's largest ticketing platform.
-- API: gateway.tkt.ge/Shows/List?categoryId={id}&api_key={public_key}
-- robots.txt: content pages allowed, checkout/search blocked.

INSERT INTO event_sources (name, url, adapter_type, config)
VALUES (
  'tkt.ge',
  'https://tkt.ge/en/concerts',
  'json_api',
  '{"categories":[2,5,16,17,18,71,73,75],"note":"Public API key in frontend JS; cats: 2=concerts,5=sports,16=theater,17=kids,18=opera,71=standup,73=masterclass,75=festival"}'
)
ON CONFLICT (name) DO UPDATE SET
  url          = EXCLUDED.url,
  adapter_type = EXCLUDED.adapter_type,
  config       = EXCLUDED.config,
  updated_at   = NOW();
