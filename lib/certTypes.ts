export type CertSectionKey = "medical" | "training" | "credentials" | "additional";

export type CertType = {
  key: string;
  label: string;
  /** Short phrase shown after “Renewal periodicity:” under the cert name (e.g. “5 years”). */
  renewalPeriodicity: string;
  section: CertSectionKey;
  /** When true, mariner must enter an expiration date before uploading. */
  requiresExpiry: boolean;
  /**
   * When a number, mariner enters certificate (issue) date and stored `expiresAt` is that date plus
   * this many calendar years. When null with `requiresExpiry`, mariner enters the document expiry date directly.
   */
  validityYears: number | null;
  /** With `requiresExpiry` false: show optional date field on upload (e.g. additional documents). */
  optionalExpiry?: boolean;
  /** Upload must include a display name (additional documents). */
  requiresCustomTitle?: boolean;
};

/** Renders in this order on the mariner dashboard. */
export const CERT_SECTIONS: {
  key: CertSectionKey;
  label: string;
  description: string;
}[] = [
  {
    key: "medical",
    label: "Medical",
    description: "Medical fitness, drug tests, and related clearances.",
  },
  {
    key: "training",
    label: "Training",
    description:
      "Contract-required courses, drills, and shipboard training qualifications.",
  },
  {
    key: "credentials",
    label: "Credentials & identification",
    description:
      "Merchant Mariner Credential, TWIC, CAC, passport, driver's license, and related IDs.",
  },
  {
    key: "additional",
    label: "Additional documents",
    description:
      "Other files — name each upload and add an expiration date if the document has one.",
  },
];

/**
 * Years of validity from certificate (issue) date. Omitted keys use direct expiry entry when
 * `requiresExpiry` (see `validityYears` on each type).
 */
const CERT_VALIDITY_YEARS: Partial<Record<string, number>> = {
  training_helicopter_firefighting: 5,
  training_cbr_d_basic: 5,
  training_damage_control: 5,
  training_environmental_programs: 5,
  training_cbr_d_indoctrination: 1,
  training_combating_trafficking_persons: 1,
  training_cbrd_officer: 5,
  training_helicopter_control_officer: 5,
  training_helicopter_landing_signalman_enlisted: 5,
  training_basic_operations_course: 5,
  training_advance_operations_course: 5,
  training_drake_c_uas: 3,
  training_bst_or_bst_refresher: 5,
  training_advanced_firefighting: 5,
  training_medical_person_in_charge: 5,
  training_urinalysis_collector: 5,
  training_breath_alcohol_testing: 5,
  training_atfp_level_iii: 3,
  training_ato_level_ii: 3,
  training_ata_level_i: 1,
  training_small_arms_min_five: 1,
  training_shipboard_security_tactics_min_five: 3,
  training_security_watchstander_advanced: 1,
  training_food_safety_management_fsm: 5,
  training_cmeo_deck: 5,
  training_cmeo_engine: 5,
  training_ekms_local_element_manager: 5,
  training_lan_administration: 5,
  training_ngw_next_gen_wideband: 5,
  training_information_assurance_awareness: 1,
  training_cargo_handling_equipment_che: 5,
};

/**
 * Master checklist. Keys are stable IDs stored on uploads—keep keys when editing labels.
 */
const _CERT_TYPES_BASE: Omit<CertType, "validityYears">[] = [
  {
    key: "medical_cg719k_application",
    section: "medical",
    label: "CG-719K (Application)",
    renewalPeriodicity: "Per document validity",
    requiresExpiry: true,
  },
  {
    key: "medical_vaccination_record",
    section: "medical",
    label: "Vaccination record",
    renewalPeriodicity: "Varies",
    requiresExpiry: false,
  },
  {
    key: "medical_uscg_certificate",
    section: "medical",
    label: "USCG Medical certificate",
    renewalPeriodicity: "2 years",
    requiresExpiry: true,
  },
  {
    key: "medical_drug_test",
    section: "medical",
    label: "Drug test",
    renewalPeriodicity: "Per policy / letter",
    requiresExpiry: false,
  },
  {
    key: "medical_history",
    section: "medical",
    label: "Medical history",
    renewalPeriodicity: "One time qualification",
    requiresExpiry: false,
  },

  // --- Training (your list) ---
  {
    key: "training_helicopter_firefighting",
    section: "training",
    label: "Helicopter Firefighting",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_cbr_d_basic",
    section: "training",
    label: "CBR-D Basic",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_damage_control",
    section: "training",
    label: "Damage Control",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_environmental_programs",
    section: "training",
    label: "Environmental Programs",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_cbr_d_indoctrination",
    section: "training",
    label: "CBR-D Indoctrination",
    renewalPeriodicity: "1 year",
    requiresExpiry: true,
  },
  {
    key: "training_combating_trafficking_persons",
    section: "training",
    label: "Combating Trafficking in Persons",
    renewalPeriodicity: "1 year",
    requiresExpiry: true,
  },
  {
    key: "training_cbrd_officer",
    section: "training",
    label: "CBRD Officer",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_helicopter_control_officer",
    section: "training",
    label: "Helicopter Control Officer (two per ship)",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_helicopter_landing_signalman_enlisted",
    section: "training",
    label: "Helicopter Landing Signalman Enlisted (two per ship)",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_rescue_boat",
    section: "training",
    label: "Rescue Boat",
    renewalPeriodicity: "Each tour of duty",
    requiresExpiry: true,
  },
  {
    key: "training_basic_operations_course",
    section: "training",
    label: "Basic Operations Course",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_advance_operations_course",
    section: "training",
    label: "Advance Operations Course",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_drake_c_uas",
    section: "training",
    label: "DRAKE C-UAS",
    renewalPeriodicity: "3 years",
    requiresExpiry: true,
  },
  {
    key: "training_visual_information_vi_team",
    section: "training",
    label: "Visual Information (VI) Team",
    renewalPeriodicity: "One time qualification",
    requiresExpiry: false,
  },
  {
    key: "training_bst_or_bst_refresher",
    section: "training",
    label: "Basic Safety Training or BST Refresher",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_advanced_firefighting",
    section: "training",
    label: "Advanced Firefighting",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_fire_smoke_detection_maintenance",
    section: "training",
    label: "Fire/Smoke Detection System Maintenance",
    renewalPeriodicity: "One time qualification",
    requiresExpiry: false,
  },
  {
    key: "training_shipboard_primary_equipment",
    section: "training",
    label: "Shipboard Primary Equipment Training",
    renewalPeriodicity: "One time qualification",
    requiresExpiry: false,
  },
  {
    key: "training_medical_person_in_charge",
    section: "training",
    label: "Medical Person in Charge",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_urinalysis_collector",
    section: "training",
    label: "Urinalysis Collector",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_breath_alcohol_testing",
    section: "training",
    label: "Breath Alcohol Testing",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_atfp_level_iii",
    section: "training",
    label: "Anti-Terrorism Force Protection Level III",
    renewalPeriodicity: "3 years",
    requiresExpiry: true,
  },
  {
    key: "training_ato_level_ii",
    section: "training",
    label: "Anti-Terrorism Officer Level II",
    renewalPeriodicity: "3 years",
    requiresExpiry: true,
  },
  {
    key: "training_ata_level_i",
    section: "training",
    label: "Anti-Terrorism Awareness Level I",
    renewalPeriodicity: "1 year",
    requiresExpiry: true,
  },
  {
    key: "training_small_arms_min_five",
    section: "training",
    label: "Small Arms (minimum five per ship)",
    renewalPeriodicity: "1 year",
    requiresExpiry: true,
  },
  {
    key: "training_shipboard_security_tactics_min_five",
    section: "training",
    label: "Shipboard Security Tactics (minimum five per ship)",
    renewalPeriodicity: "3 years",
    requiresExpiry: true,
  },
  {
    key: "training_security_watchstander_basic",
    section: "training",
    label: "Security Watchstander Basic",
    renewalPeriodicity: "One time qualification",
    requiresExpiry: false,
  },
  {
    key: "training_security_watchstander_advanced",
    section: "training",
    label: "Security Watchstander Advanced",
    renewalPeriodicity: "1 year",
    requiresExpiry: true,
  },
  {
    key: "training_food_safety_management_fsm",
    section: "training",
    label: "Food Safety Management (FSM)",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_supply_configuration_management",
    section: "training",
    label: "Supply/Configuration Management",
    renewalPeriodicity: "One time qualification",
    requiresExpiry: false,
  },
  {
    key: "training_cmeo_deck",
    section: "training",
    label: "CMEO deck",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_cmeo_engine",
    section: "training",
    label: "CMEO engine",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_ekms_local_element_manager",
    section: "training",
    label: "EKMS Local Element Manager",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_gmdss_general",
    section: "training",
    label: "Global Maritime Distress and Safety System",
    renewalPeriodicity: "One time qualification",
    requiresExpiry: false,
  },
  {
    key: "training_gmdss_maintainer",
    section: "training",
    label: "Global Maritime Distress and Safety System Maintainer",
    renewalPeriodicity: "One time qualification",
    requiresExpiry: false,
  },
  {
    key: "training_lan_administration",
    section: "training",
    label: "Local Area Network (LAN Administration)",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_ngw_next_gen_wideband",
    section: "training",
    label: "NGW (Next Generation Wideband)",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_information_assurance_awareness",
    section: "training",
    label: "Information Assurance Awareness (IAA)",
    renewalPeriodicity: "1 year",
    requiresExpiry: true,
  },
  {
    key: "training_cargo_handling_equipment_che",
    section: "training",
    label: "Cargo Handling Equipment (CHE)",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "training_material_handling_equipment_mhe",
    section: "training",
    label: "Material Handling Equipment (MHE)",
    renewalPeriodicity: "Contract period or designation (varies)",
    requiresExpiry: false,
  },

  // --- Credentials & identification ---
  {
    key: "merchant_mariner_credential",
    section: "credentials",
    label: "Merchant Mariner Credential",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "twic",
    section: "credentials",
    label: "TWIC",
    renewalPeriodicity: "5 years",
    requiresExpiry: true,
  },
  {
    key: "common_access_card",
    section: "credentials",
    label: "Common Access Card (CAC)",
    renewalPeriodicity: "Per document validity",
    requiresExpiry: true,
  },
  {
    key: "passport",
    section: "credentials",
    label: "Passport",
    renewalPeriodicity: "Per document validity",
    requiresExpiry: true,
  },
  {
    key: "drivers_license",
    section: "credentials",
    label: "Driver's license",
    renewalPeriodicity: "Per document validity",
    requiresExpiry: true,
  },

  // --- Additional documents (custom name per file; optional expiry) ---
  {
    key: "additional_document",
    section: "additional",
    label: "Additional document",
    renewalPeriodicity: "",
    requiresExpiry: false,
    optionalExpiry: true,
    requiresCustomTitle: true,
  },
];

/** Built-in defaults used to seed `store.certTemplates` and as fallback. */
export const DEFAULT_CERT_TYPES: CertType[] = _CERT_TYPES_BASE.map((c) => ({
  ...c,
  validityYears: c.requiresExpiry
    ? (CERT_VALIDITY_YEARS[c.key] ?? null)
    : null,
}));

/** @deprecated Prefer resolving types from the store at runtime. */
export const CERT_TYPES: CertType[] = DEFAULT_CERT_TYPES;

/**
 * Human-readable renewal line derived from template rules (shown to mariners and office).
 */
export function autoRenewalPeriodicityLabel(
  cert: Pick<
    CertType,
    "requiresExpiry" | "validityYears" | "section" | "requiresCustomTitle"
  >,
): string {
  if (cert.requiresCustomTitle) return "";
  if (!cert.requiresExpiry) {
    if (cert.section === "training") return "One time qualification";
    if (cert.section === "medical") return "Varies";
    return "";
  }
  if (cert.validityYears == null) return "Per document validity";
  const y = cert.validityYears;
  return `${y} ${y === 1 ? "year" : "years"}`;
}

/** Same ordering everywhere: Medical → Training → Credentials → Additional, then store order within each section. */
export function sortCertTypesByDefaultSectionOrder(types: CertType[]): CertType[] {
  const sectionRank = new Map(
    CERT_SECTIONS.map((s, i) => [s.key, i] as const),
  );
  const indexInStore = new Map(types.map((t, i) => [t.key, i] as const));
  return [...types].sort((a, b) => {
    const ra = sectionRank.get(a.section) ?? 99;
    const rb = sectionRank.get(b.section) ?? 99;
    if (ra !== rb) return ra - rb;
    return (indexInStore.get(a.key) ?? 0) - (indexInStore.get(b.key) ?? 0);
  });
}

export function certTypeByKeyFromList(
  key: string,
  list: CertType[],
): CertType | undefined {
  return list.find((c) => c.key === key);
}

/** @deprecated Prefer `certTypeByKeyFromList(key, store.certTemplates)`. */
export function certTypeByKey(key: string): CertType | undefined {
  return certTypeByKeyFromList(key, DEFAULT_CERT_TYPES);
}

export function documentDisplayLabel(
  certKey: string,
  customTitle?: string | null,
  certTypes: CertType[] = DEFAULT_CERT_TYPES,
): string {
  const t = customTitle?.trim();
  if (t) return t;
  return certTypeByKeyFromList(certKey, certTypes)?.label ?? certKey;
}
