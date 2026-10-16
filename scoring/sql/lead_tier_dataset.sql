/*
    Lead tier dataset: one row per deal, with the raw lead form answers exactly
    as the browser submitted them and a 30-day close-call outcome.

    Answers come from SUBMISSION_RESPONSE for the deal's own submission, so the
    values are the same strings the form's scoring engine sees at submit time.
    Deals open or closed are both included; the 30-day window, not the deal
    closing, is what makes an outcome final.

    Outcome definitions:
      is_outcome_mature     deal is at least 30 days old
      is_cc_eligible        a close call outcome was recorded (true / false)
      is_cc_completed_30d   close call completed within 30 days of creation
*/

WITH deals AS (

    SELECT
        d.id::STRING AS deal_id,
        d.createdate::DATE AS deal_created_date,
        d.form_conversion_id,
        d.form_version AS deal_form_version,
        d.hs_is_closed AS is_closed,
        d.hs_is_closed_won AS is_closed_won,
        LOWER(TRIM(d.close_call_completed)) AS close_call_status,
        d.close_call_date,
        LOWER(SPLIT_PART(COALESCE(d.contact_email, ''), '@', -1)) AS email_domain
    FROM PROD_DWH.TARGET_SCHEMA.TARGET_DEALS_HS d
    WHERE d.form_conversion_id IS NOT NULL
      AND d.createdate >= '2026-01-22'
      AND LOWER(COALESCE(d.dealtype, '')) IN ('newbusiness', 'cross-sell', 'upsell')
      AND LOWER(COALESCE(d.athena_package, '')) NOT IN (
          'free plan', 'freeplan', 'pay per task', 'pp tasks', 'ppt'
      )
      AND NOT (COALESCE(d.contact_email, '') ILIKE ANY ('%test%', '%qa%', '%@athenago.com'))

),

answers AS (

    SELECT
        r.conversion_id,
        r.field_name,
        ARRAY_AGG(DISTINCT r.field_value) AS field_values
    FROM PROD_DWH.LANDING_HUBSPOT.SUBMISSION_RESPONSE r
    WHERE r.form_id = 'a7a1a71d-fee0-4c1b-85ea-05aede171179'
      AND NULLIF(TRIM(r.field_value), '') IS NOT NULL
      AND (
          STARTSWITH(r.field_name, 'hbform_')
          OR r.field_name IN (
              'hdyhau_primary', 'utm_medium', 'utm_source',
              'leadformversion', 'leadscoring_score', 'leadscoring_tier'
          )
      )
    GROUP BY 1, 2

),

submissions AS (

    SELECT
        conversion_id,
        OBJECT_AGG(field_name, field_values::VARIANT) AS fields
    FROM answers
    GROUP BY 1

)

SELECT
    d.deal_id,
    d.deal_created_date::STRING AS deal_created_date,
    COALESCE(s.fields:leadformversion[0]::STRING, d.deal_form_version) AS form_version,
    d.email_domain,
    d.is_closed,
    d.is_closed_won,
    d.close_call_status,
    d.close_call_date::STRING AS close_call_date,

    d.deal_created_date <= DATEADD(DAY, -30, CURRENT_DATE()) AS is_outcome_mature,
    d.close_call_status IN ('true', 'false') AS is_cc_eligible,
    d.close_call_status = 'true'
        AND (
            d.close_call_date IS NULL
            OR d.close_call_date <= DATEADD(DAY, 30, d.deal_created_date)
        ) AS is_cc_completed_30d,

    TRY_TO_NUMBER(s.fields:leadscoring_score[0]::STRING) AS stored_score,
    s.fields:leadscoring_tier[0]::STRING AS stored_tier,
    OBJECT_DELETE(
        s.fields, 'leadformversion', 'leadscoring_score', 'leadscoring_tier'
    ) AS answers
FROM deals d
JOIN submissions s
    ON s.conversion_id = d.form_conversion_id
ORDER BY d.deal_created_date, d.deal_id
