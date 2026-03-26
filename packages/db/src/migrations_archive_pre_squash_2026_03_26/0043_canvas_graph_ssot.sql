ALTER TABLE "documents" ADD COLUMN "canvas_graph_json" text;
--> statement-breakpoint
ALTER TABLE "document_revisions" ADD COLUMN "canvas_graph_json" text;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hypowork_is_canvas_graph_json(body_text text)
RETURNS boolean AS $$
BEGIN
  IF body_text IS NULL OR trim(body_text) = '' THEN
    RETURN false;
  END IF;
  BEGIN
    IF jsonb_typeof(body_text::jsonb) != 'object' THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(body_text::jsonb->'nodes') != 'array' OR jsonb_typeof(body_text::jsonb->'edges') != 'array' THEN
      RETURN false;
    END IF;
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hypowork_extract_prose_from_canvas_graph(body_text text)
RETURNS text AS $$
DECLARE
  j jsonb;
  el jsonb;
  parts text[] := ARRAY[]::text[];
  b text;
BEGIN
  IF body_text IS NULL OR trim(body_text) = '' THEN
    RETURN '';
  END IF;
  BEGIN
    j := body_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN body_text;
  END;
  IF jsonb_typeof(j->'nodes') != 'array' THEN
    RETURN '';
  END IF;
  FOR el IN SELECT * FROM jsonb_array_elements(j->'nodes')
  LOOP
    IF (el->>'type' IN ('sticky', 'sketch', 'docPage')) AND el ? 'data' THEN
      b := el->'data'->>'body';
      IF b IS NOT NULL AND trim(b) <> '' THEN
        parts := array_append(parts, trim(b));
      END IF;
    END IF;
  END LOOP;
  RETURN array_to_string(parts, E'\n\n');
END;
$$ LANGUAGE plpgsql IMMUTABLE;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hypowork_strip_primary_docpage_body(graph_text text, doc_id text)
RETURNS text AS $$
DECLARE
  j jsonb;
  new_nodes jsonb;
BEGIN
  IF graph_text IS NULL OR trim(graph_text) = '' THEN
    RETURN graph_text;
  END IF;
  BEGIN
    j := graph_text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN graph_text;
  END;
  IF jsonb_typeof(j->'nodes') != 'array' THEN
    RETURN graph_text;
  END IF;
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'type' = 'docPage' AND (
        (elem->'data'->>'isPrimaryDocument') = 'true'
        OR (
          (elem->'data'->>'documentId') IS NOT NULL
          AND lower(trim(elem->'data'->>'documentId')) = lower(trim(doc_id))
        )
      )
      THEN jsonb_set(
        COALESCE(elem, '{}'::jsonb),
        '{data,body}',
        to_jsonb(''::text),
        true
      )
      ELSE elem
    END
  )
  INTO new_nodes
  FROM jsonb_array_elements(j->'nodes') AS elem;
  RETURN jsonb_build_object(
    'nodes', COALESCE(new_nodes, '[]'::jsonb),
    'edges', COALESCE(j->'edges', '[]'::jsonb)
  )::text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
--> statement-breakpoint
UPDATE "documents" d
SET
  "latest_body" = hypowork_extract_prose_from_canvas_graph(d."latest_body"),
  "canvas_graph_json" = hypowork_strip_primary_docpage_body(d."latest_body", d."id"::text)
WHERE hypowork_is_canvas_graph_json(d."latest_body");
--> statement-breakpoint
UPDATE "document_revisions" dr
SET
  "body" = hypowork_extract_prose_from_canvas_graph(dr."body"),
  "canvas_graph_json" = hypowork_strip_primary_docpage_body(dr."body", dr."document_id"::text)
WHERE hypowork_is_canvas_graph_json(dr."body");
--> statement-breakpoint
DROP FUNCTION IF EXISTS hypowork_is_canvas_graph_json(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS hypowork_extract_prose_from_canvas_graph(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS hypowork_strip_primary_docpage_body(text, text);
