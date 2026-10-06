import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';

/** Every route the app serves, as "METHOD /v1/path/:param". */
export function listRoutes(app: INestApplication): string[] {
  const routes: string[] = [];
  const wrappers = [...app.get(ModulesContainer).values()].flatMap((m) => [...m.controllers.values()]);
  for (const wrapper of wrappers) {
    const controller = wrapper.metatype as (new (...args: never[]) => object) | null;
    if (!controller) continue;
    const base = (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ?? '';
    const proto = controller.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      const handler = proto[name];
      if (name === 'constructor' || typeof handler !== 'function') continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (method === undefined || path === undefined) continue;
      const full = ['v1', base, path]
        .map((p) => p.replace(/^\/+|\/+$/g, ''))
        .filter(Boolean)
        .join('/');
      routes.push(`${RequestMethod[method]} /${full}`);
    }
  }
  return routes.sort();
}
