import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSampleApplicantProfile } from '../src/features/applicant-profile/sampleProfile'

const apiSeedDir = join(dirname(fileURLToPath(import.meta.url)), '../../api/internal/seeddata')
mkdirSync(apiSeedDir, { recursive: true })
writeFileSync(join(apiSeedDir, 'sample_applicant_profile.json'), JSON.stringify(getSampleApplicantProfile(), null, 2) + '\n')
