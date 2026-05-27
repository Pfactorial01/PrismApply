-- Tech-stack discovery queries (Serper-tested with 30-day freshness applied at search time).
INSERT INTO discovery_search_queries (query, priority) VALUES
    -- Node / TypeScript / JS
    ('site:jobs.lever.co ("node.js" OR "nodejs" OR "node developer")', 15),
    ('site:boards.greenhouse.io ("node.js" OR "typescript" OR "javascript")', 15),
    ('site:jobs.ashbyhq.com ("node.js" OR "typescript")', 15),
    ('site:jobs.lever.co ("nestjs" OR "express.js" OR "fastify")', 20),
    ('site:boards.greenhouse.io "full stack" ("react" OR "next.js")', 20),
    ('site:jobs.ashbyhq.com ("next.js" OR "react" OR "typescript")', 25),

    -- Python
    ('site:jobs.lever.co ("python" OR "django" OR "fastapi")', 15),
    ('site:boards.greenhouse.io ("python" OR "django" OR "fastapi")', 15),
    ('site:jobs.ashbyhq.com ("python" OR "flask" OR "django")', 25),
    ('site:jobs.lever.co "machine learning" ("python" OR "pytorch")', 25),

    -- Go / Rust / systems
    ('site:jobs.lever.co ("golang" OR "go engineer" OR "go developer")', 20),
    ('site:boards.greenhouse.io ("rust" OR "golang" OR "systems engineer")', 20),
    ('site:jobs.ashbyhq.com ("rust" OR "golang")', 25),
    ('site:jobs.lever.co ("c++" OR "cpp" OR "embedded")', 20),

    -- JVM
    ('site:jobs.lever.co ("java" OR "kotlin" OR "spring boot")', 20),
    ('site:boards.greenhouse.io ("java engineer" OR "kotlin" OR "spring")', 20),
    ('site:jobs.ashbyhq.com ("java" OR "kotlin")', 25),
    ('site:boards.greenhouse.io ("scala" OR "spark" OR "kafka")', 20),

    -- .NET / API
    ('site:jobs.lever.co (".net" OR "csharp" OR "C#")', 25),
    ('site:jobs.lever.co ("graphql" OR "api engineer" OR "backend")', 20),

    -- Frontend
    ('site:jobs.lever.co ("react" OR "frontend engineer" OR "frontend developer")', 20),
    ('site:boards.greenhouse.io ("react" OR "vue" OR "angular")', 20),
    ('site:jobs.ashbyhq.com ("frontend" OR "react" OR "vue")', 25),

    -- Mobile
    ('site:jobs.lever.co ("iOS" OR "Swift" OR "Android" OR "Kotlin")', 25),

    -- Data / ML
    ('site:jobs.lever.co ("data engineer" OR "spark" OR "airflow")', 20),
    ('site:boards.greenhouse.io ("data engineer" OR "dbt" OR "snowflake")', 20),
    ('site:jobs.ashbyhq.com ("machine learning" OR "ML engineer" OR "LLM")', 25),

    -- DevOps / cloud / infra
    ('site:jobs.lever.co ("kubernetes" OR "k8s" OR "terraform")', 20),
    ('site:boards.greenhouse.io ("devops" OR "SRE" OR "platform engineer")', 20),
    ('site:jobs.ashbyhq.com ("aws" OR "cloud engineer" OR "infrastructure")', 25),
    ('site:jobs.lever.co ("docker" OR "CI/CD" OR "GitOps")', 30),

    -- Databases
    ('site:boards.greenhouse.io ("postgres" OR "postgresql" OR "mongodb")', 35),
    ('site:jobs.lever.co ("redis" OR "kafka" OR "postgresql")', 35),

    -- Ruby / PHP
    ('site:jobs.lever.co ("ruby" OR "rails" OR "ruby on rails")', 30),
    ('site:jobs.lever.co ("php" OR "laravel" OR "wordpress")', 30),

    -- Security / QA
    ('site:boards.greenhouse.io ("security engineer" OR "application security")', 30),
    ('site:jobs.ashbyhq.com ("QA engineer" OR "SDET" OR "test automation")', 30),

    -- Senior / leadership
    ('site:jobs.lever.co ("staff engineer" OR "principal engineer" OR "senior software")', 40),
    ('site:boards.greenhouse.io ("engineering manager" OR "tech lead")', 40),

    -- Remote
    ('site:jobs.lever.co remote ("software engineer" OR "backend")', 50),
    ('site:boards.greenhouse.io remote ("software engineer" OR "backend engineer")', 50),
    ('site:jobs.ashbyhq.com remote ("typescript" OR "python" OR "go")', 55)
ON CONFLICT (query) DO NOTHING;

-- Replace weak remote query (2 ATS hits in testing) with stronger variant above.
UPDATE discovery_search_queries
SET active = false
WHERE query = 'site:job-boards.greenhouse.io "software engineer" remote';
