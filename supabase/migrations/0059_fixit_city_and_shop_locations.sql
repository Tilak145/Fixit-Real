-- Where each served city is, and a first fix for the shops and requests that
-- already exist. Without these, an emergency has nothing to measure from and
-- falls back to the plain city order — correct, but not "nearest".

update public.service_cities set
  lat = case label
    when 'Akron, OH' then 41.0814
    when 'Cuyahoga Falls, OH' then 41.1339
    when 'Kent, OH' then 41.1537
    when 'Stow, OH' then 41.1595
    when 'Barberton, OH' then 40.9936
  end,
  lng = case label
    when 'Akron, OH' then -81.5190
    when 'Cuyahoga Falls, OH' then -81.4846
    when 'Kent, OH' then -81.3579
    when 'Stow, OH' then -81.4404
    when 'Barberton, OH' then -81.6046
  end
where label in ('Akron, OH', 'Cuyahoga Falls, OH', 'Kent, OH', 'Stow, OH', 'Barberton, OH');

-- A job without its own point takes the centre of its city, which is what the
-- request origin already falls back to; recording it keeps the request itself
-- readable in the dashboard.

-- Never invent a shop address: a professional without coordinates simply
-- ranks by the old order until their address is picked again and geocoded.
