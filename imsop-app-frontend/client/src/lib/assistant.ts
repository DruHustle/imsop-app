export function extractIdentifiers(
  question: string,
  known: string[] = []
): string[] {
  const spans: { id: string; start: number; end: number }[] = [];
  for (const id of known) {
    const text = question.toLowerCase(),
      identity = id.toLowerCase();
    let offset = text.indexOf(identity);
    while (offset >= 0) {
      const before = text[offset - 1],
        after = text[offset + identity.length];
      if (
        (!before || !/[a-z0-9_-]/i.test(before)) &&
        (!after || !/[a-z0-9_-]/i.test(after))
      )
        spans.push({ id, start: offset, end: offset + identity.length });
      offset = text.indexOf(identity, offset + 1);
    }
  }
  for (const match of Array.from(
    question.matchAll(
      /\b[A-Z0-9][A-Z0-9_.:-]*[0-9][A-Z0-9_.:-]*\b|(?<![A-Z0-9_.:-])(?:SHP|ORD)-[A-Z0-9_-]+(?![A-Z0-9_.:-])/gi
    )
  ))
    spans.push({
      id: match[0],
      start: match.index!,
      end: match.index! + match[0].length,
    });
  // A complete identifier owns its text span, including punctuation. Never
  // interpret a suffix or an internal numeric segment as another requested ID.
  const complete = spans.filter(
    span =>
      !spans.some(
        other =>
          other.start <= span.start &&
          other.end >= span.end &&
          (other.start < span.start || other.end > span.end)
      )
  );
  return Array.from(
    new Map(complete.map(({ id }) => [id.toLowerCase(), id])).values()
  ).slice(0, 10);
}
import { Source } from "@/contexts/DataContext";
import {
  Shipment,
  OperationalOrder,
  Mode,
  formatTime,
  DEMO_AS_OF,
  isException,
} from "./workspace";
export interface AnswerRecord {
  key: string;
  identifier: string;
  kind: "shipment" | "order";
  route: string;
  status: string;
  observedAt: string | null;
  eta: string | null;
  href: string;
}
export interface Answer {
  records?: AnswerRecord[];
  unresolved?: string[];
  text: string;
  links: { label: string; href: string }[];
  source: string;
}
export function answerQuestion(
  question: string,
  shipments: Source<Shipment>,
  orders: Source<OperationalOrder>,
  mode: Mode
): Answer {
  const prefix = mode === "demo" ? "Demonstration response. " : "";
  const source =
    mode === "demo"
      ? `Deterministic demo dataset · As of ${DEMO_AS_OF}`
      : "Authorized Node operational database snapshot · Scope: complete matching selection";
  const records: AnswerRecord[] = [],
    unresolved: string[] = [];
  const result = (text: string, links: Answer["links"] = []): Answer => ({
    text: prefix + text,
    links,
    source,
    records,
    unresolved,
  });
  const tokens = extractIdentifiers(question, [
    ...shipments.items.map(s => s.trackingNumber),
    ...orders.items.map(o => o.orderNumber),
  ]);
  if (tokens.length) {
    const links: Answer["links"] = [],
      descriptions: string[] = [];
    for (const token of tokens) {
      const matches =
        shipments.status === "ready"
          ? shipments.items.filter(
              s => s.trackingNumber.toLowerCase() === token.toLowerCase()
            )
          : [];
      const matchesOrders =
        orders.status === "ready"
          ? orders.items.filter(
              o => o.orderNumber.toLowerCase() === token.toLowerCase()
            )
          : [];
      if (matches.length + matchesOrders.length > 1) {
        descriptions.push(
          `${token}: several sources use this identifier. Open a stable record link to choose the intended record.`
        );
        continue;
      }
      const item = matches[0],
        order = matchesOrders[0];
      if (item) {
        records.push({
          key: "shipment:" + item.id,
          identifier: item.trackingNumber,
          kind: "shipment",
          route: `${item.origin} → ${item.destination}`,
          status: item.status,
          observedAt: item.observedAt,
          eta: item.estimatedArrival,
          href: `/supply-chain/shipments/${item.id}`,
        });
        descriptions.push(
          `${item.trackingNumber}: ${item.status}. ${item.origin} → ${item.destination}. Carrier: ${item.carrier}; mode: ${item.transportMode}. ETA: ${formatTime(item.estimatedArrival)}. Latest event observation: ${formatTime(item.observedAt)}. Provider: ${item.provider ?? "not supplied"}. Received: ${formatTime(item.receivedAt)}.`
        );
        links.push({
          label: `Open ${item.trackingNumber}`,
          href: `/supply-chain/shipments/${item.id}`,
        });
      } else if (order) {
        records.push({
          key: "order:" + order.id,
          identifier: order.orderNumber,
          kind: "order",
          route: `Customer ${order.customerId ?? "not supplied"}`,
          status: order.status,
          observedAt: order.createdAt,
          eta: null,
          href: `/supply-chain/orders/${order.id}`,
        });
        descriptions.push(
          `${order.orderNumber}: ${order.status}. Amount: ${order.totalAmount ?? "not supplied"}; ${order.currency ?? "currency not supplied"}. Created: ${formatTime(order.createdAt)}. Supplier and shipment associations are unavailable.`
        );
        links.push({
          label: `Open ${order.orderNumber}`,
          href: `/supply-chain/orders/${order.id}`,
        });
      } else {
        const message =
          /^ORD-/i.test(token) && orders.status === "forbidden"
            ? "Orders are unavailable for your role."
            : shipments.status !== "ready"
              ? "The shipment source is unavailable. Retry the source read."
              : `${token} was not found in the permitted context. I cannot infer its status or location.`;
        unresolved.push(message);
        descriptions.push(message);
        links.push({
          label: "Search shipments",
          href: "/supply-chain/shipments",
        });
      }
    }
    return result(
      (tokens.length > 1
        ? "Comparison of recorded status, route and ETA. "
        : "") + descriptions.join("\n\n"),
      links
    );
  }
  if (/order|\bORD-/i.test(question) && orders.status !== "ready")
    return result(
      orders.status === "forbidden"
        ? "Orders are unavailable for your role."
        : "The order source is unavailable. Retry the source read before asking about orders."
    );
  if (shipments.status !== "ready")
    return result(
      shipments.status === "forbidden"
        ? "Shipment access is forbidden for this session."
        : shipments.status === "loading"
          ? "The shipment source is still loading. Try again when the read completes."
          : "The shipment source is unavailable. Retry the source read; no demo data has been substituted."
    );
  if (tokens.length)
    return result(
      `${tokens.join(", ")} was not found in the selected authorized record scope. I cannot infer its status or location.`,
      [{ label: "Search shipments", href: "/supply-chain/shipments" }]
    );
  if (/delayed|exception|attention/i.test(question)) {
    const affected = shipments.items.filter(isException);
    return result(
      `${affected.length} of ${shipments.items.length} shipments have a recorded delayed or exception status. No cause, financial impact or live weather evidence is available.`,
      affected.slice(0, 5).map(s => ({
        label: `${s.trackingNumber} · ${s.status}`,
        href: `/supply-chain/shipments/${s.id}`,
      }))
    );
  }
  if (/summary|how many|shipments|overview/i.test(question))
    return result(
      `${shipments.items.length} shipments in the selected scope: ${shipments.items.filter(s => s.status === "In transit").length} in transit, ${shipments.items.filter(s => s.status === "Delivered").length} delivered, ${shipments.items.filter(isException).length} needing attention. These are database counts, not real-time tracking.`,
      [{ label: "Review shipment list", href: "/supply-chain/shipments" }]
    );
  return result(
    "I can look up a tracking/order number, count shipments, or list delayed and exception records. A model provider is not configured. I cannot predict demand, verify weather, book shipments, change inventory or run infrastructure actions."
  );
}
