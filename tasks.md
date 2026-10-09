NESTJSSSSSSSSSSSSs

# dockerize project

# formatter linter 

# stcucture  MVCRS add respository layer 

# error handlign exception 

# add fastify for run 

# translate response 

# add Interceptors for response 

# add boilerPlate  nestJs 

# redesign package add package  

# document system  optional (swagger)


 {
	"name": "niroomotor-back",
	"version": "0.0.1",
	"description": "",
	"author": "",
	"private": true,
	"scripts": {
		"build": "nest build",
		"deploy": "nest deploy",
		"start": "nest start",
		"start:dev": "nest start --watch",
		"start:debug": "nest start --debug --watch",
		"start:prod": "node --enable-source-maps dist/main.js",
		"test": "vitest run",
		"test:watch": "vitest",
		"test:e2e": "vitest run --config vitest.config.e2e.mts",
		"test:cov": "vitest run --coverage",
		"lint": "pnpx ultracite check",
		"format": "pnpx ultracite fix",
		"db:generate": "drizzle-kit generate",
		"db:migrate": "drizzle-kit migrate",
		"db:push": "drizzle-kit push",
		"db:seed": "nest start --entryFile seed"
	},
	"dependencies": {
		"@fastify/helmet": "^13.1.1",
		"@fastify/multipart": "^10.1.1",
		"@fastify/static": "^10.1.3",
		"@nestjs/common": "^12.0.1",
		"@nestjs/config": "^12.0.0",
		"@nestjs/core": "^12.0.1",
		"@nestjs/jwt": "^12.0.1",
		"@nestjs/observe": "^0.1.8",
		"@nestjs/passport": "^12.0.0",
		"@nestjs/platform-fastify": "^12.0.1",
		"@nestjs/schedule": "^12.0.1",
		"@nestjs/swagger": "^12.0.1",
		"bcryptjs": "^3.0.3",
		"class-transformer": "^0.5.1",
		"class-validator": "^0.15.1",
		"dotenv": "^17.4.2",
		"drizzle-kit": "^0.31.10",
		"drizzle-orm": "^0.45.2",
		"fastify": "5.12.1",
		"file-type": "^22.0.2",
		"joi": "^18.2.9",
		"minio": "^8.0.7",
		"passport": "^0.7.0",
		"passport-jwt": "^4.0.1",
		"postgres": "^3.4.9",
		"redis": "^6.2.1",
		"reflect-metadata": "^0.2.2",
		"rxjs": "^7.8.1"
	},
	"devDependencies": {
		"@biomejs/biome": "2.5.7",
		"@nestjs/cli": "^12.0.0",
		"@nestjs/mau": "^0.2.6",
		"@nestjs/schematics": "^12.0.0",
		"@nestjs/testing": "^12.0.1",
		"@types/node": "^24.0.0",
		"@types/passport": "^1.0.17",
		"@types/passport-jwt": "^4.0.1",
		"@vitest/coverage-v8": "^4.1.2",
		"typescript": "^6.0.2",
		"vitest": "^4.1.2"
	}
}
 
 
NEXTJS 


# update package json 
 

{
	"name": "talapanah",
	"version": "0.1.0",
	"private": true,
	"scripts": {
		"dev": "next dev",
		"build": "next build",
		"start": "next start",
		"lint": "pnpm dlx ultracite check",
		"format": "pnpm dlx ultracite fix",
		"test:e2e": "playwright test",
		"test:e2e:ui": "playwright test --ui"
	},
	"dependencies": {
		"@base-ui/react": "^1.7.0",
		"@better-fetch/fetch": "^1.3.1",
		"@daypicker/persian": "10.0.1",
		"@hookform/resolvers": "^5.9.1",
		"@t3-oss/env-nextjs": "^0.13.11",
		"@tanstack/react-query": "^5.101.4",
		"@tanstack/react-query-devtools": "^5.101.4",
		"@tanstack/react-table": "^9.2.4",
		"class-variance-authority": "^0.7.1",
		"clsx": "^2.1.1",
		"cookies-next": "^6.1.1",
		"framer-motion": "^14.0.0",
		"input-otp": "^1.5.0",
		"lodash": "^4.18.1",
		"lucide-react": "^1.33.0",
		"motion": "^13.1.1",
		"next": "16.3.1",
		"next-themes": "^0.4.6",
		"nuqs": "^2.10.1",
		"radix-ui": "^1.6.7",
		"react": "19.2.8",
		"react-day-picker": "^10.0.1",
		"react-dom": "19.2.8",
		"react-hook-form": "^7.85.0",
		"recharts": "^3.10.1",
		"shadcn": "^4.18.0",
		"simplebar-react": "^3.3.2",
		"sonner": "^2.0.8",
		"swiper": "^14.3.0",
		"tailwind-merge": "^3.6.0",
		"tw-animate-css": "^1.4.0",
		"uuid": "^14.0.2",
		"zod": "^4.4.3"
	},
	"devDependencies": {
		"@biomejs/biome": "2.5.9",
		"@playwright/test": "^1.63.0",
		"@tailwindcss/postcss": "^4",
		"@types/lodash": "^4.17.25",
		"@types/node": "^20",
		"@types/react": "^19",
		"@types/react-dom": "^19",
		"tailwindcss": "^4",
		"typescript": "^5"
	},
	"packageManager": "pnpm@10.29.3"
}
 

# [x] add shadcn (components.json and src/components/ui/button.tsx are configured)
# add agents file skiils file 
# Error handling

## Tailwind CSS migration (gradual)
- [x] Use the existing Tailwind v4 and shadcn setup as the default for new UI.
- [x] Convert the shared shell styles to Tailwind utilities.
- [x] Migrate the shared collection table to Tailwind and the shadcn Table primitive.
- [ ] Migrate auth, dashboard, organization, performance, and system views route by route.
- [ ] Remove Dashlite and legacy theme.css imports after all dependent views are migrated.
