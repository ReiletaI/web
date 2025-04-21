# 🌐 Web Reiletai

Application frontend développée avec **Next.js** en mode standalone.

## 📋 Prérequis

- Node.js ≥ 22 (pour développement local)
- Docker ≥ 20.10 et Docker Compose ≥ 1.29

## ⚙️ Configuration des variables d’environnement

1. Copiez `.env.local.example` en `.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://backend:8000
   ```
2. La variable `NEXT_PUBLIC_API_URL` est injectée à la build pour les rewrites Next.js.

> [!NOTE]
> backend est le nom du service Docker, que vous pourriez utiliser dans votre `docker-compose.yml`.
> Vous pouvez également utiliser 172.17.0.1:8000, pour sortir du network docker.