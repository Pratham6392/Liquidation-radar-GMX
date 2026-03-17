import fetch from "node-fetch";
import { GRAPHQL_URL } from "../config";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export async function graphqlQuery<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL HTTP error: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;

  if (json.errors && json.errors.length) {
    const msg = json.errors.map((e) => e.message).join("; ");
    throw new Error(`GraphQL error: ${msg}`);
  }

  if (!json.data) {
    throw new Error("GraphQL response missing data");
  }

  return json.data;
}

