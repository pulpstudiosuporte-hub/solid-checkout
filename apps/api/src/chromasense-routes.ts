import { createHash } from "node:crypto";
import type { AppEnvironment } from "@solid/config";
import type {
  ChromaSenseEventType,
  Prisma,
  PrismaClient,
} from "@solid/database";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthRepository } from "./auth-repository.js";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
const errorBody = (request: FastifyRequest, code: string, message: string) => ({
  error: { code, message, requestId: request.id },
});
const publicId = (value: unknown): string | null =>
  typeof value === "string" && /^[A-Za-z0-9_-]{8,32}$/.test(value)
    ? value
    : null;
const clamp = (
  value: unknown,
  min: number,
  max: number,
  fallback = min,
): number => {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
};
const cleanText = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim()
    ? value
        .trim()
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .slice(0, max)
    : null;
const allowedTypes = new Set<ChromaSenseEventType>([
  "VIEW",
  "CLICK",
  "MOVE",
  "SCROLL",
  "ATTENTION",
]);

type InputEvent = {
  type?: unknown;
  x?: unknown;
  y?: unknown;
  scrollPercent?: unknown;
  durationMs?: unknown;
  target?: unknown;
  targetLabel?: unknown;
  interactive?: unknown;
  rage?: unknown;
};

export function normalizeChromaSenseEvent(
  value: unknown,
): Prisma.ChromaSenseEventCreateManyInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as InputEvent;
  if (
    typeof input.type !== "string" ||
    !allowedTypes.has(input.type as ChromaSenseEventType)
  )
    return null;
  const hasPoint = ["CLICK", "MOVE", "ATTENTION"].includes(input.type);
  return {
    sessionId: "",
    type: input.type as ChromaSenseEventType,
    x: hasPoint ? clamp(input.x, 0, 1, 0.5) : null,
    y: hasPoint ? clamp(input.y, 0, 1, 0.5) : null,
    scrollPercent:
      input.type === "SCROLL"
        ? Math.round(clamp(input.scrollPercent, 0, 100, 0))
        : null,
    durationMs:
      input.type === "ATTENTION"
        ? Math.round(clamp(input.durationMs, 0, 30_000, 0))
        : null,
    target: input.type === "CLICK" ? cleanText(input.target, 160) : null,
    targetLabel:
      input.type === "CLICK" ? cleanText(input.targetLabel, 120) : null,
    interactive:
      input.type === "CLICK" && typeof input.interactive === "boolean"
        ? input.interactive
        : null,
    rage: input.type === "CLICK" && input.rage === true,
  };
}

const periodStart = (period: string | undefined): Date => {
  const days =
    period === "today" ? 1 : period === "30d" ? 30 : period === "90d" ? 90 : 7;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
};

export function registerChromaSenseRoutes(
  app: FastifyInstance,
  environment: AppEnvironment,
  auth: AuthRepository,
  db: PrismaClient,
): void {
  const sessionCookie =
    environment.NODE_ENV === "production"
      ? "__Host-solid_session"
      : "solid_session";
  const dashboardContext = async (request: FastifyRequest) => {
    const raw = request.cookies[sessionCookie];
    const current = raw
      ? await auth.findActiveSession(sha256(raw), new Date())
      : null;
    if (!current) return null;
    const selected = await db.session.findFirst({
      where: { id: current.sessionId, userId: current.userId, revokedAt: null },
      select: { activeStoreId: true },
    });
    if (!selected?.activeStoreId) return null;
    const member = await db.storeMember.findUnique({
      where: {
        storeId_userId: {
          storeId: selected.activeStoreId,
          userId: current.userId,
        },
      },
      select: { id: true },
    });
    return member ? { storeId: selected.activeStoreId } : null;
  };

  app.post<{
    Params: { sessionId: string };
    Headers: { authorization?: string };
    Body: {
      events?: unknown;
      viewport?: unknown;
      device?: unknown;
      pageKey?: unknown;
    };
  }>(
    "/public/checkout-sessions/:sessionId/chromasense/events",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const id = publicId(request.params.sessionId);
      const token = request.headers.authorization?.startsWith("Bearer ")
        ? request.headers.authorization.slice(7)
        : "";
      if (!id || token.length < 32 || token.length > 128)
        return reply
          .code(401)
          .send(errorBody(request, "INVALID_SESSION", "Sessão inválida."));
      const checkoutSession = await db.checkoutSession.findFirst({
        where: { publicId: id, tokenHash: sha256(token) },
        select: {
          id: true,
          checkoutId: true,
          checkout: { select: { storeId: true } },
        },
      });
      if (!checkoutSession)
        return reply
          .code(404)
          .send(
            errorBody(request, "SESSION_NOT_FOUND", "Sessão indisponível."),
          );
      const bodyEvents = Array.isArray(request.body?.events)
        ? request.body.events.slice(0, 100)
        : [];
      const events = bodyEvents
        .map(normalizeChromaSenseEvent)
        .filter((event): event is Prisma.ChromaSenseEventCreateManyInput =>
          Boolean(event),
        );
      if (!events.length) return reply.code(204).send();
      const viewport =
        request.body?.viewport &&
        typeof request.body.viewport === "object" &&
        !Array.isArray(request.body.viewport)
          ? (request.body.viewport as Record<string, unknown>)
          : {};
      const device = ["mobile", "tablet", "desktop"].includes(
        String(request.body?.device),
      )
        ? String(request.body.device)
        : "desktop";
      const pageKey = cleanText(request.body?.pageKey, 100) || "checkout";
      const width = Math.round(clamp(viewport.width, 240, 7680, 1280));
      const height = Math.round(clamp(viewport.height, 240, 4320, 720));
      const maxScroll = events.reduce(
        (max, event) => Math.max(max, event.scrollPercent ?? 0),
        0,
      );
      const attention = events
        .filter((event) => event.type === "ATTENTION")
        .reduce((sum, event) => sum + (event.durationMs ?? 0), 0);
      const rageClicks = events.filter((event) => event.rage).length;
      const deadClicks = events.filter(
        (event) => event.type === "CLICK" && event.interactive === false,
      ).length;
      const previous = await db.chromaSenseSession.findUnique({
        where: { checkoutSessionId: checkoutSession.id },
        select: { maxScrollPercent: true },
      });
      const retainedMaxScroll = Math.max(
        previous?.maxScrollPercent ?? 0,
        maxScroll,
      );
      const analyticsSession = await db.chromaSenseSession.upsert({
        where: { checkoutSessionId: checkoutSession.id },
        create: {
          storeId: checkoutSession.checkout.storeId,
          checkoutId: checkoutSession.checkoutId,
          checkoutSessionId: checkoutSession.id,
          pageKey,
          deviceType: device,
          viewportWidth: width,
          viewportHeight: height,
          eventCount: events.length,
          activeMs: attention,
          visibleMs: attention,
          maxScrollPercent: maxScroll,
          rageClickCount: rageClicks,
          deadClickCount: deadClicks,
        },
        update: {
          pageKey,
          deviceType: device,
          viewportWidth: width,
          viewportHeight: height,
          eventCount: { increment: events.length },
          activeMs: { increment: attention },
          visibleMs: { increment: attention },
          maxScrollPercent: retainedMaxScroll,
          rageClickCount: { increment: rageClicks },
          deadClickCount: { increment: deadClicks },
          lastSeenAt: new Date(),
        },
        select: { id: true },
      });
      await db.chromaSenseEvent.createMany({
        data: events.map((event) => ({
          ...event,
          sessionId: analyticsSession.id,
        })),
      });
      return reply
        .header("cache-control", "no-store")
        .code(202)
        .send({ accepted: events.length });
    },
  );

  app.get<{ Querystring: { period?: string; checkoutId?: string; device?: string } }>(
    "/chromasense",
    async (request, reply) => {
      const context = await dashboardContext(request);
      if (!context)
        return reply
          .code(401)
          .send(
            errorBody(request, "UNAUTHENTICATED", "Autenticação necessária."),
          );
      const start = periodStart(request.query.period);
      const checkoutId = publicId(request.query.checkoutId);
      const device = ["mobile", "tablet", "desktop"].includes(
        request.query.device || "",
      )
        ? request.query.device
        : null;
      const where: Prisma.ChromaSenseSessionWhereInput = {
        storeId: context.storeId,
        startedAt: { gte: start },
        ...(checkoutId ? { checkout: { publicId: checkoutId } } : {}),
        ...(device ? { deviceType: device } : {}),
      };
      const [sessions, availableCheckouts] = await Promise.all([
        db.chromaSenseSession.findMany({
          where,
          orderBy: { startedAt: "desc" },
          take: 500,
          select: {
            id: true,
            publicId: true,
            deviceType: true,
            viewportWidth: true,
            viewportHeight: true,
            eventCount: true,
            activeMs: true,
            maxScrollPercent: true,
            rageClickCount: true,
            deadClickCount: true,
            startedAt: true,
            lastSeenAt: true,
            checkout: { select: { publicId: true, name: true, slug: true } },
            checkoutSession: { select: { status: true, completedAt: true } },
          },
        }),
        db.checkout.findMany({
          where: {
            storeId: context.storeId,
            archivedAt: null,
            status: "PUBLISHED",
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: {
            publicId: true,
            name: true,
            slug: true,
            publishedConfig: true,
            product: {
              select: { checkoutTitle: true, priceCents: true, imageUrl: true },
            },
          },
        }),
      ]);
      const events = sessions.length
        ? await db.chromaSenseEvent.findMany({
            where: {
              sessionId: { in: sessions.map((session) => session.id) },
              createdAt: { gte: start },
            },
            orderBy: { createdAt: "asc" },
            take: 25_000,
            select: {
              sessionId: true,
              type: true,
              x: true,
              y: true,
              scrollPercent: true,
              durationMs: true,
              target: true,
              targetLabel: true,
              interactive: true,
              rage: true,
            },
          })
        : [];
      const clickEvents = events.filter((event) => event.type === "CLICK");
      const groupedTargets = new Map<
        string,
        {
          target: string;
          label: string;
          clicks: number;
          rage: number;
          dead: number;
        }
      >();
      for (const event of clickEvents) {
        const target = event.target || "Área do checkout";
        const current = groupedTargets.get(target) || {
          target,
          label: event.targetLabel || target,
          clicks: 0,
          rage: 0,
          dead: 0,
        };
        current.clicks += 1;
        if (event.rage) current.rage += 1;
        if (event.interactive === false) current.dead += 1;
        groupedTargets.set(target, current);
      }
      const topTargets = [...groupedTargets.values()]
        .sort((left, right) => right.clicks - left.clicks)
        .slice(0, 12);
      const completed = sessions.filter(
        (session) => session.checkoutSession.status === "COMPLETED",
      ).length;
      const abandoned = sessions.length - completed;
      const rageClicks = sessions.reduce(
        (sum, session) => sum + session.rageClickCount,
        0,
      );
      const deadClicks = sessions.reduce(
        (sum, session) => sum + session.deadClickCount,
        0,
      );
      const lowScroll = sessions.filter(
        (session) => session.maxScrollPercent < 45,
      ).length;
      const insights = [
        ...(abandoned
          ? [
              {
                key: "abandonment",
                severity:
                  sessions.length && abandoned / sessions.length > 0.6
                    ? "high"
                    : "medium",
                title: "Abandono antes da conclusão",
                description: `${abandoned} de ${sessions.length} sessões não chegaram à confirmação.`,
              },
            ]
          : []),
        ...(rageClicks
          ? [
              {
                key: "rage",
                severity: "high",
                title: "Cliques repetidos detectados",
                description: `${rageClicks} clique(s) de frustração. Revise os alvos destacados no mapa.`,
              },
            ]
          : []),
        ...(deadClicks
          ? [
              {
                key: "dead",
                severity: "medium",
                title: "Cliques sem ação aparente",
                description: `${deadClicks} clique(s) ocorreram fora de controles interativos.`,
              },
            ]
          : []),
        ...(lowScroll
          ? [
              {
                key: "scroll",
                severity: "low",
                title: "Conteúdo abaixo da dobra",
                description: `${lowScroll} sessão(ões) visualizaram menos de 45% da página.`,
              },
            ]
          : []),
      ];
      const checkoutCounts = new Map<string, number>();
      for (const session of sessions)
        checkoutCounts.set(
          session.checkout.publicId,
          (checkoutCounts.get(session.checkout.publicId) || 0) + 1,
        );
      const checkouts = availableCheckouts
        .map((checkout) => ({
          publicId: checkout.publicId,
          name: checkout.name,
          slug: checkout.slug,
          sessions: checkoutCounts.get(checkout.publicId) || 0,
          preview: {
            config: checkout.publishedConfig,
            product: {
              title: checkout.product.checkoutTitle,
              priceCents: checkout.product.priceCents,
              imageUrl: checkout.product.imageUrl,
            },
          },
        }))
        .sort(
          (left, right) =>
            right.sessions - left.sessions ||
            left.name.localeCompare(right.name, "pt-BR"),
        );
      return reply.header("cache-control", "private, no-store").send({
        period: request.query.period || "7d",
        summary: {
          sessions: sessions.length,
          clickSessions: new Set(clickEvents.map((event) => event.sessionId))
            .size,
          clicks: clickEvents.length,
          attentionMs: sessions.reduce(
            (sum, session) => sum + session.activeMs,
            0,
          ),
          conversionRate: sessions.length
            ? Math.round((completed / sessions.length) * 1000) / 10
            : 0,
          insightCount: insights.length,
        },
        checkouts,
        points: Object.fromEntries(
          ["CLICK", "MOVE", "ATTENTION"].map((type) => [
            type.toLowerCase(),
            events
              .filter(
                (event) =>
                  event.type === type && event.x !== null && event.y !== null,
              )
              .slice(-4000)
              .map((event) => ({
                x: event.x,
                y: event.y,
                weight:
                  event.type === "ATTENTION"
                    ? Math.max(1, Math.round((event.durationMs || 1000) / 1000))
                    : 1,
              })),
          ]),
        ),
        scroll: {
          average: sessions.length
            ? Math.round(
                sessions.reduce(
                  (sum, session) => sum + session.maxScrollPercent,
                  0,
                ) / sessions.length,
              )
            : 0,
          distribution: [25, 50, 75, 100].map(
            (limit) =>
              sessions.filter((session) => session.maxScrollPercent <= limit)
                .length,
          ),
        },
        topTargets,
        insights,
        sessions: sessions
          .slice(0, 100)
          .map((session) => ({
            publicId: session.publicId,
            checkout: session.checkout,
            device: session.deviceType,
            events: session.eventCount,
            durationMs: session.activeMs,
            maxScroll: session.maxScrollPercent,
            rageClicks: session.rageClickCount,
            deadClicks: session.deadClickCount,
            completed: session.checkoutSession.status === "COMPLETED",
            startedAt: session.startedAt,
            lastSeenAt: session.lastSeenAt,
          })),
      });
    },
  );
}
