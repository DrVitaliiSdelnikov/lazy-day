-- Add biletebi.ge as an event source.
-- Biletebi.ge serves pre-rendered HTML to crawlers (Googlebot UA),
-- allowing cheerio-style parsing without a headless browser.
-- Categories covered: concerts, theatres, museum, education, sport, tourism, children.

INSERT INTO event_sources (name, url, adapter_type, config) VALUES
  ('biletebi.ge', 'https://biletebi.ge/en/concerts', 'html_parser',
   '{"categories":["concerts","theatres"],"note":"Googlebot UA required for pre-rendered HTML. Other categories (museum/sport/tourism) omit dates from listing."}')
ON CONFLICT (name) DO UPDATE
  SET url = EXCLUDED.url,
      adapter_type = EXCLUDED.adapter_type,
      config = EXCLUDED.config,
      enabled = true;
