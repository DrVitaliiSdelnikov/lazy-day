CREATE TYPE source_type AS ENUM (
  'google_places', 'osm', 'tkt_ge', 'jsonld', 'ics',
  'bandsintown', 'manual'
);

CREATE TYPE entity_type AS ENUM ('place', 'event', 'venue');

CREATE TYPE event_status AS ENUM ('scheduled', 'postponed', 'cancelled', 'past');

CREATE TYPE company_type AS ENUM ('solo', 'couple', 'family', 'friends');

CREATE TYPE interaction_action AS ENUM (
  'impression', 'click', 'save', 'hide', 'share', 'clickout'
);

CREATE TYPE dedup_status AS ENUM ('pending', 'merged', 'rejected');
