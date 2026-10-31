import type { GraphQLResolveInfo } from 'graphql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

/** The type of action recorded in an audit log entry. */
export enum ActionType {
  /** A new entity was created. */
  Create = 'CREATE',
  /** An entity was deleted. */
  Delete = 'DELETE',
  /** An existing entity was modified. */
  Update = 'UPDATE'
}

/** A record of a create, update, or delete action performed on an entity. */
export type AuditLog = {
  __typename?: 'AuditLog';
  /** The type of action that was performed (create, update, or delete). */
  actionType: ActionType;
  /** Unique identifier for this audit log entry. */
  id: Scalars['ID']['output'];
  /** JSON representation of the object after the action (null for deletes). */
  newValue?: Maybe<Scalars['String']['output']>;
  /** The type of object that was affected. */
  objectType: ObjectType;
  /** JSON representation of the object before the action (null for creates). */
  oldValue?: Maybe<Scalars['String']['output']>;
  /** The schema version used when this log entry was created. */
  schemaVersion: SchemaVersion;
  /** Identifier of the user or system that performed the action. */
  updatedBy: Scalars['String']['output'];
  /** ISO 8601 timestamp of when the action was performed. */
  updatedDate: Scalars['String']['output'];
};

export type BookingAnswerInput = {
  fieldId: Scalars['String']['input'];
  uploadId?: InputMaybe<Scalars['ID']['input']>;
  /** Scalar answer as text. FILE fields use uploadId instead. */
  value?: InputMaybe<Scalars['String']['input']>;
};

export type BookingAnswerView = {
  __typename?: 'BookingAnswerView';
  fieldId: Scalars['String']['output'];
  value?: Maybe<Scalars['String']['output']>;
};

/** One appointment on the clinic calendar. */
export type BookingAppointment = {
  __typename?: 'BookingAppointment';
  bookingSubmissionId?: Maybe<Scalars['ID']['output']>;
  durationMinutes: Scalars['Int']['output'];
  endsAt: Scalars['String']['output'];
  facilityId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  /** The fullName answer, when the form asked for it. */
  patientName?: Maybe<Scalars['String']['output']>;
  /** The doctor schedule this visit holds time on. Null is clinic time. */
  practitionerId?: Maybe<Scalars['ID']['output']>;
  startsAt: Scalars['String']['output'];
  status: BookingAppointmentStatus;
};

/**
 * Appointment lifecycle. A submit creates REQUESTED. Staff confirm or decline it.
 * Staff or the patient may cancel. REQUESTED and CONFIRMED hold the slot.
 */
export enum BookingAppointmentStatus {
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Confirmed = 'CONFIRMED',
  Declined = 'DECLINED',
  Requested = 'REQUESTED'
}

export enum BookingCancelledBy {
  Clinic = 'CLINIC',
  Patient = 'PATIENT'
}

/** A clinic the signed-in user may open in the booking dashboard. */
export type BookingClinic = {
  __typename?: 'BookingClinic';
  /** True when the user may change members and booking settings. */
  canManage: Scalars['Boolean']['output'];
  clinicName: Scalars['String']['output'];
  clinicSiteSlug?: Maybe<Scalars['String']['output']>;
  facilityId: Scalars['ID']['output'];
  /** Appointments still REQUESTED, waiting for the clinic to confirm or decline. */
  requestedCount: Scalars['Int']['output'];
  /** Null for admins, who reach every clinic without a membership. */
  role?: Maybe<ClinicMemberRole>;
};

/**
 * How carefully an answer or upload must be retained.
 * IDENTITY_DOCUMENT covers insurance cards, eligibility certificates, マイナポータル insurance screenshots,
 * and the patient's photo. A My Number card or its number is never collected.
 */
export enum BookingFieldSensitivity {
  IdentityDocument = 'IDENTITY_DOCUMENT',
  Medical = 'MEDICAL',
  Standard = 'STANDARD'
}

/**
 * The intake form for one clinic.
 * Find a Doc owns the fields. The clinic owns allowed visit lengths.
 * clinicId in the URL is facilityId when the directory listing exists.
 */
export type BookingForm = {
  __typename?: 'BookingForm';
  /** Visit lengths the clinic offers, in minutes. Each value is 15, 30, 45, or 60. */
  allowedDurations: Array<Scalars['Int']['output']>;
  clinicName: Scalars['String']['output'];
  /** Hosted clinic page id. Null when the clinic has no Find a Doc landing. */
  clinicSiteId?: Maybe<Scalars['ID']['output']>;
  clinicSiteSlug?: Maybe<Scalars['String']['output']>;
  /** The offered length the Book page preselects. */
  defaultDuration: Scalars['Int']['output'];
  /** Directory facility id. The reusable Book URL uses this when present. */
  facilityId?: Maybe<Scalars['ID']['output']>;
  fields: Array<BookingFormField>;
  id: Scalars['ID']['output'];
  /** Languages the clinic or one of its doctors speaks, for the patient's language filter. */
  languages: Array<Locale>;
  /** Doctors at this clinic the patient may choose. */
  practitioners: Array<BookingPractitioner>;
  themePrimary?: Maybe<Scalars['String']['output']>;
  version: Scalars['Int']['output'];
};

/**
 * One input on a clinic booking form.
 * labelKey is the site i18n key when label is null. A CRM may set label per locale.
 */
export type BookingFormField = {
  __typename?: 'BookingFormField';
  accept?: Maybe<Scalars['String']['output']>;
  /** Site i18n key for a line under the field, such as why it is asked. */
  hintKey?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  labelKey: Scalars['String']['output'];
  /** NUMBER: the highest value. DATE: the latest date, in calendar years from today in Japan time. */
  max?: Maybe<Scalars['Float']['output']>;
  maxBytes?: Maybe<Scalars['Int']['output']>;
  maxLength?: Maybe<Scalars['Int']['output']>;
  /** NUMBER: the lowest value. DATE: the earliest date, in calendar years from today in Japan time. */
  min?: Maybe<Scalars['Float']['output']>;
  options?: Maybe<Array<BookingFormFieldOption>>;
  placeholderKey?: Maybe<Scalars['String']['output']>;
  /** Required while the field is shown. A field hidden by showWhen is never required. */
  required: Scalars['Boolean']['output'];
  sensitivity: BookingFieldSensitivity;
  /** The field is shown, and its answer kept, only while this condition holds. */
  showWhen?: Maybe<BookingFormFieldCondition>;
  /** Groups fields into one step of the intake form. The site renders steps in first-seen order. */
  stepKey: Scalars['String']['output'];
  type: BookingFormFieldType;
};

/** Shows a field only while another field's answer equals a value. */
export type BookingFormFieldCondition = {
  __typename?: 'BookingFormFieldCondition';
  equals: Scalars['String']['output'];
  fieldId: Scalars['ID']['output'];
};

/** One choice on a SELECT booking field. */
export type BookingFormFieldOption = {
  __typename?: 'BookingFormFieldOption';
  label?: Maybe<Scalars['String']['output']>;
  labelKey: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/**
 * Field type on a clinic booking form.
 * A later CRM picks the fields; the web renderer stays generic.
 */
export enum BookingFormFieldType {
  /** A calendar date, sent as YYYY-MM-DD. min and max are whole calendar years from today in Japan time. */
  Date = 'DATE',
  Email = 'EMAIL',
  File = 'FILE',
  Number = 'NUMBER',
  Phone = 'PHONE',
  Select = 'SELECT',
  Text = 'TEXT',
  Textarea = 'TEXTAREA'
}

/** One intake form type a clinic may offer. Definitions are owned by Find a Doc. */
export type BookingFormType = {
  __typename?: 'BookingFormType';
  id: Scalars['ID']['output'];
  /** Site i18n key for the form name. */
  labelKey: Scalars['String']['output'];
  version: Scalars['Int']['output'];
};

/** A doctor at a booking clinic. */
export type BookingPractitioner = {
  __typename?: 'BookingPractitioner';
  /**
   * True when the doctor has weekly hours or open windows of their own, and is
   * booked separately from other doctors. Otherwise they book on the clinic schedule.
   */
  hasOwnSchedule: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  names: Array<LocalizedName>;
  specialties: Array<Specialty>;
  spokenLanguages: Array<Locale>;
};

/** Clinic-chosen booking options. */
export type BookingSettings = {
  __typename?: 'BookingSettings';
  /** Visit lengths in minutes. Each value is 15, 30, 45, or 60. */
  allowedDurations: Array<Scalars['Int']['output']>;
  /** The offered length the Book page preselects. */
  defaultDuration: Scalars['Int']['output'];
  facilityId: Scalars['ID']['output'];
  /** Intake forms the clinic offers. The first is the default. */
  formDefinitionIds: Array<Scalars['String']['output']>;
};

/** Read-only staff detail. Scalar answers only; files are separate download links. */
export type BookingSubmissionDetail = {
  __typename?: 'BookingSubmissionDetail';
  answers: Array<BookingAnswerView>;
  appointmentId?: Maybe<Scalars['ID']['output']>;
  appointmentStatus?: Maybe<BookingAppointmentStatus>;
  cancelledBy?: Maybe<BookingCancelledBy>;
  clinicName: Scalars['String']['output'];
  clinicSiteId?: Maybe<Scalars['ID']['output']>;
  clinicSiteSlug?: Maybe<Scalars['String']['output']>;
  createdDate: Scalars['String']['output'];
  endsAt?: Maybe<Scalars['String']['output']>;
  facilityId?: Maybe<Scalars['ID']['output']>;
  formDefinitionId: Scalars['String']['output'];
  formVersion: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  locale: Scalars['String']['output'];
  practitionerId?: Maybe<Scalars['ID']['output']>;
  /** The chosen or assigned doctor's names. Empty when no doctor was named. */
  practitionerNames: Array<LocalizedName>;
  service?: Maybe<Scalars['String']['output']>;
  /** Languages the patient asked for. */
  spokenLanguages: Array<Locale>;
  startsAt?: Maybe<Scalars['String']['output']>;
  status: BookingSubmissionStatus;
  /** Reason staff or the patient gave for a decline or cancel. */
  statusReason?: Maybe<Scalars['String']['output']>;
  updatedDate: Scalars['String']['output'];
  uploads: Array<BookingUploadView>;
};

/** Staff list row. Identity files are never inlined; use bookingUploadDownloadUrl. */
export type BookingSubmissionListItem = {
  __typename?: 'BookingSubmissionListItem';
  appointmentId?: Maybe<Scalars['ID']['output']>;
  appointmentStatus?: Maybe<BookingAppointmentStatus>;
  clinicName: Scalars['String']['output'];
  clinicSiteId?: Maybe<Scalars['ID']['output']>;
  clinicSiteSlug?: Maybe<Scalars['String']['output']>;
  createdDate: Scalars['String']['output'];
  endsAt?: Maybe<Scalars['String']['output']>;
  facilityId?: Maybe<Scalars['ID']['output']>;
  formDefinitionId: Scalars['String']['output'];
  formVersion: Scalars['Int']['output'];
  hasIdentityUploads: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  locale: Scalars['String']['output'];
  patientName?: Maybe<Scalars['String']['output']>;
  startsAt?: Maybe<Scalars['String']['output']>;
  status: BookingSubmissionStatus;
  updatedDate: Scalars['String']['output'];
};

/** Result of a patient booking submission. No medical free-text is returned. */
export type BookingSubmissionResult = {
  __typename?: 'BookingSubmissionResult';
  appointmentId?: Maybe<Scalars['ID']['output']>;
  clinicSiteId?: Maybe<Scalars['ID']['output']>;
  createdDate: Scalars['String']['output'];
  facilityId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  /**
   * The private token for /book/manage#{token}, returned once to the submitter.
   * The same link is in the confirmation email, which may not arrive (SES sandbox, typo).
   */
  manageToken?: Maybe<Scalars['String']['output']>;
  status: BookingSubmissionStatus;
};

export type BookingSubmissionSearchFilters = {
  appointmentStatus?: InputMaybe<BookingAppointmentStatus>;
  clinicSiteId?: InputMaybe<Scalars['ID']['input']>;
  facilityId?: InputMaybe<Scalars['ID']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<OrderBy>>;
};

/** Whether the request emails went out. The visit itself is BookingAppointmentStatus. */
export enum BookingSubmissionStatus {
  FailedNotify = 'FAILED_NOTIFY',
  Notified = 'NOTIFIED',
  Received = 'RECEIVED'
}

/** How the browser should open a booking upload. */
export enum BookingUploadDisposition {
  /** Save the file. */
  Attachment = 'ATTACHMENT',
  /** Show the file in the browser. */
  Inline = 'INLINE'
}

export type BookingUploadDownloadUrl = {
  __typename?: 'BookingUploadDownloadUrl';
  downloadUrl: Scalars['String']['output'];
  expiresAt: Scalars['String']['output'];
  uploadId: Scalars['ID']['output'];
};

export type BookingUploadHeader = {
  __typename?: 'BookingUploadHeader';
  name: Scalars['String']['output'];
  value: Scalars['String']['output'];
};

/** A pending upload slot. The browser PUTs the file to uploadUrl, then submits the booking. */
export type BookingUploadUrl = {
  __typename?: 'BookingUploadUrl';
  expiresAt: Scalars['String']['output'];
  headers: Array<BookingUploadHeader>;
  objectKey: Scalars['String']['output'];
  uploadId: Scalars['ID']['output'];
  uploadUrl: Scalars['String']['output'];
};

export type BookingUploadView = {
  __typename?: 'BookingUploadView';
  byteSize?: Maybe<Scalars['Int']['output']>;
  contentType: Scalars['String']['output'];
  fieldId: Scalars['String']['output'];
  fileName: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  purgedAt?: Maybe<Scalars['String']['output']>;
  retainUntil?: Maybe<Scalars['String']['output']>;
  sensitivity: BookingFieldSensitivity;
};

export type CancelBookingByTokenInput = {
  reason?: InputMaybe<Scalars['String']['input']>;
  /** The private token from the confirmation email link. */
  token: Scalars['String']['input'];
};

/** A search city owned by one prefecture. The same English slug may exist in two prefectures. */
export type City = {
  __typename?: 'City';
  /** Optional Google place id. Display fields are not stored here. */
  googlePlaceId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  /** Six-digit national local-government code. A register refresh matches on this. */
  localGovernmentCode: Scalars['String']['output'];
  /** English name with no City or Ward suffix. */
  nameEn: Scalars['String']['output'];
  /** Japanese name, keeping 区, 市, 町, or 村. */
  nameJa: Scalars['String']['output'];
  prefecture: Prefecture;
  /** Unique within the prefecture. Tokyo Chuo and Yamanashi Chuo are both chuo. */
  slug: Scalars['String']['output'];
};

/** A live Places city suggestion. Only placeId may be stored, and only on the matched city. */
export type CitySuggestion = {
  __typename?: 'CitySuggestion';
  /** Our city when the suggestion maps onto exactly one municipality. */
  city?: Maybe<City>;
  /** Live suggestion text. Not a stored field. */
  label: Scalars['String']['output'];
  /** Google place id for the suggested city. */
  placeId: Scalars['String']['output'];
};

/** A dated range with no open time: a holiday, a day off, or one closed weekly block. */
export type ClinicAvailabilityClosure = {
  __typename?: 'ClinicAvailabilityClosure';
  createdDate: Scalars['String']['output'];
  endsAt: Scalars['String']['output'];
  facilityId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  /** Null closes the whole clinic, every doctor included. */
  practitionerId?: Maybe<Scalars['ID']['output']>;
  reason?: Maybe<Scalars['String']['output']>;
  startsAt: Scalars['String']['output'];
};

/** Staff-painted availability. Boundaries are 30-minute aligned. */
export type ClinicAvailabilityWindow = {
  __typename?: 'ClinicAvailabilityWindow';
  clinicSiteId?: Maybe<Scalars['ID']['output']>;
  createdDate: Scalars['String']['output'];
  endsAt: Scalars['String']['output'];
  facilityId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  /** Null is the clinic's own schedule. */
  practitionerId?: Maybe<Scalars['ID']['output']>;
  startsAt: Scalars['String']['output'];
};

/** A person invited to, or signed in to, one clinic's booking dashboard. */
export type ClinicMember = {
  __typename?: 'ClinicMember';
  /** True after the invited person signed in with that verified email. */
  claimed: Scalars['Boolean']['output'];
  createdDate: Scalars['String']['output'];
  email?: Maybe<Scalars['String']['output']>;
  facilityId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  role: ClinicMemberRole;
};

/** OWNER also manages members and booking settings. STAFF reads bookings and edits the calendar. */
export enum ClinicMemberRole {
  Owner = 'OWNER',
  Staff = 'STAFF'
}

/**
 * An account linked to a hosted clinic. Not returned by the public page query.
 * A future CRM authorizes appointments and patients with this row.
 */
export type ClinicMembership = {
  __typename?: 'ClinicMembership';
  clinicSiteId: Scalars['ID']['output'];
  createdDate: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  role: ClinicMembershipRole;
  userId: Scalars['ID']['output'];
};

/** Role of an account on a hosted clinic. Owner manages the clinic. Staff uses the future CRM. */
export enum ClinicMembershipRole {
  Owner = 'OWNER',
  Staff = 'STAFF'
}

/**
 * A clinic-owned page. id is the id accounts and a future CRM attach to.
 * facilityId is the directory listing, null until that facility exists.
 */
export type ClinicSite = {
  __typename?: 'ClinicSite';
  doctors: Array<ClinicSiteDoctor>;
  facilityId?: Maybe<Scalars['ID']['output']>;
  heroPath: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  languages: Array<ClinicSiteLanguage>;
  locales: Array<ClinicSiteLocale>;
  shareImagePath: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  status: ClinicSiteStatus;
  theme: ClinicSiteTheme;
};

export type ClinicSiteCase = {
  __typename?: 'ClinicSiteCase';
  detail: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

/**
 * A doctor shown on the hosted page.
 * hpId is the directory professional once that record exists.
 */
export type ClinicSiteDoctor = {
  __typename?: 'ClinicSiteDoctor';
  hpId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  imagePath: Scalars['String']['output'];
  nameEn: Scalars['String']['output'];
  nameJa: Scalars['String']['output'];
  objectPosition: Scalars['String']['output'];
};

export type ClinicSiteDoctorCopy = {
  __typename?: 'ClinicSiteDoctorCopy';
  alt: Scalars['String']['output'];
  paragraphs: Array<Scalars['String']['output']>;
  role: Scalars['String']['output'];
  tag: Scalars['String']['output'];
};

/** A language the clinic consults in. This is not a site UI locale. */
export type ClinicSiteLanguage = {
  __typename?: 'ClinicSiteLanguage';
  bcp47: Scalars['String']['output'];
  code: Scalars['String']['output'];
  native: Scalars['String']['output'];
};

/** The hosted page in one site locale. */
export type ClinicSiteLocale = {
  __typename?: 'ClinicSiteLocale';
  about: Array<Scalars['String']['output']>;
  aboutEyebrow: Scalars['String']['output'];
  aboutTitle: Scalars['String']['output'];
  badgeDetail: Scalars['String']['output'];
  badgeTitle: Scalars['String']['output'];
  book: Scalars['String']['output'];
  bookEyebrow: Scalars['String']['output'];
  bookLead: Scalars['String']['output'];
  bookNote: Scalars['String']['output'];
  bookTitle: Scalars['String']['output'];
  cases: Array<ClinicSiteCase>;
  casesEyebrow: Scalars['String']['output'];
  casesLead: Scalars['String']['output'];
  casesTitle: Scalars['String']['output'];
  ctaButton: Scalars['String']['output'];
  ctaLead: Scalars['String']['output'];
  ctaTitle: Scalars['String']['output'];
  description: Scalars['String']['output'];
  doctorCopy: Array<ClinicSiteDoctorCopy>;
  doctorsEyebrow: Scalars['String']['output'];
  doctorsTitle: Scalars['String']['output'];
  emergency: Scalars['String']['output'];
  fees: Array<Scalars['String']['output']>;
  feesEyebrow: Scalars['String']['output'];
  feesLead: Scalars['String']['output'];
  feesLink: Scalars['String']['output'];
  feesTitle: Scalars['String']['output'];
  flowEyebrow: Scalars['String']['output'];
  flowTitle: Scalars['String']['output'];
  heroAlt: Scalars['String']['output'];
  heroBadge: Scalars['String']['output'];
  heroLead: Scalars['String']['output'];
  heroNote: Scalars['String']['output'];
  heroTitleBefore: Scalars['String']['output'];
  heroTitleHighlight: Scalars['String']['output'];
  highlights: Array<Scalars['String']['output']>;
  includedLabel: Scalars['String']['output'];
  locale: Scalars['String']['output'];
  name: Scalars['String']['output'];
  navCases: Scalars['String']['output'];
  navDoctors: Scalars['String']['output'];
  navFees: Scalars['String']['output'];
  navFlow: Scalars['String']['output'];
  noticeEyebrow: Scalars['String']['output'];
  noticeLead: Scalars['String']['output'];
  noticeTitle: Scalars['String']['output'];
  notices: Array<ClinicSiteNotice>;
  plans: Array<ClinicSitePlan>;
  rangeLabel: Scalars['String']['output'];
  referralNote: Scalars['String']['output'];
  sectionNavLabel: Scalars['String']['output'];
  seeFees: Scalars['String']['output'];
  steps: Array<ClinicSiteStep>;
};

export type ClinicSiteNotice = {
  __typename?: 'ClinicSiteNotice';
  detail: Scalars['String']['output'];
  feesLink?: Maybe<Scalars['Boolean']['output']>;
  title: Scalars['String']['output'];
};

export type ClinicSitePlan = {
  __typename?: 'ClinicSitePlan';
  amount: Scalars['String']['output'];
  note: Scalars['String']['output'];
};

/**
 * Whether a hosted clinic page is a draft, a showcase, or published.
 * Drafts are hidden from the public queries.
 */
export enum ClinicSiteStatus {
  Draft = 'DRAFT',
  Preview = 'PREVIEW',
  Published = 'PUBLISHED'
}

export type ClinicSiteStep = {
  __typename?: 'ClinicSiteStep';
  detail: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

/** Enough of a hosted clinic to redirect its directory address to the clean link. */
export type ClinicSiteSummary = {
  __typename?: 'ClinicSiteSummary';
  facilityId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  /**
   * Site locales the clinic has page copy for, sorted. The page, its generated
   * HTML, the sitemap, and hreflang offer only these.
   */
  localeCodes: Array<Scalars['String']['output']>;
  shareImagePath: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  status: ClinicSiteStatus;
};

/**
 * Brand color for a hosted clinic. A later picker writes `primary`.
 * The page turns it into the theme primary. Null keeps the Find a Doc primary.
 */
export type ClinicSiteTheme = {
  __typename?: 'ClinicSiteTheme';
  primary?: Maybe<Scalars['String']['output']>;
};

/**
 * One usual opening block in Japan time. Open starts are weekly hours plus painted
 * windows, minus closures, minus held appointments.
 */
export type ClinicWeeklyHours = {
  __typename?: 'ClinicWeeklyHours';
  /** Minutes after midnight JST, on a 30-minute boundary. At most 1440. */
  endMinute: Scalars['Int']['output'];
  facilityId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  /** Null is the clinic's own schedule. */
  practitionerId?: Maybe<Scalars['ID']['output']>;
  /** Minutes after midnight JST, on a 30-minute boundary. */
  startMinute: Scalars['Int']['output'];
  /** ISO weekday: 1 is Monday, 7 is Sunday. */
  weekday: Scalars['Int']['output'];
};

export type ClinicWeeklyHoursInput = {
  endMinute: Scalars['Int']['input'];
  startMinute: Scalars['Int']['input'];
  weekday: Scalars['Int']['input'];
};

/** Contact information for a facility. */
export type Contact = {
  __typename?: 'Contact';
  /**
   * Physical mailing address.
   * Null on an online facility (no street address).
   */
  address?: Maybe<PhysicalAddress>;
  /** Email address. */
  email?: Maybe<Scalars['String']['output']>;
  /** Google Maps URL for the facility location. Empty on an online facility. */
  googleMapsUrl: Scalars['String']['output'];
  /** Phone number. */
  phone: Scalars['String']['output'];
  /** Website URL. */
  website?: Maybe<Scalars['String']['output']>;
};

/** Input for providing contact information. */
export type ContactInput = {
  /**
   * Physical mailing address.
   * Required for a normal facility. Omit for an online facility.
   */
  address?: InputMaybe<PhysicalAddressInput>;
  /** Email address. */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Google Maps URL for the facility location. Omit or empty for an online facility. */
  googleMapsUrl?: InputMaybe<Scalars['String']['input']>;
  /** Phone number. */
  phone: Scalars['String']['input'];
  /** Website URL. */
  website?: InputMaybe<Scalars['String']['input']>;
};

export type CreateBookingUploadUrlInput = {
  byteSize?: InputMaybe<Scalars['Int']['input']>;
  /** Facility id, clinic site id, or clinic site slug. */
  clinicSiteId: Scalars['ID']['input'];
  contentType: Scalars['String']['input'];
  fieldId: Scalars['String']['input'];
  fileName: Scalars['String']['input'];
  /** The form the file belongs to. Defaults to the clinic's default form. */
  formDefinitionId?: InputMaybe<Scalars['String']['input']>;
};

export type CreateClinicAvailabilityClosureInput = {
  /** Facility id, clinic site id, or clinic site slug. */
  clinicId: Scalars['ID']['input'];
  /** Snapped up to 30 minutes. ISO 8601 UTC. At most 62 days after startsAt. */
  endsAt: Scalars['String']['input'];
  /** A doctor at this clinic. Null closes the whole clinic. */
  practitionerId?: InputMaybe<Scalars['ID']['input']>;
  reason?: InputMaybe<Scalars['String']['input']>;
  /** Snapped down to 30 minutes. ISO 8601 UTC. */
  startsAt: Scalars['String']['input'];
};

export type CreateClinicAvailabilityWindowInput = {
  clinicSiteId: Scalars['ID']['input'];
  endsAt: Scalars['String']['input'];
  /** A doctor at this clinic. Null paints clinic time. */
  practitionerId?: InputMaybe<Scalars['ID']['input']>;
  startsAt: Scalars['String']['input'];
};

/** Input for creating a new facility. */
export type CreateFacilityInput = {
  /** Id of a city in the vocabulary. Publishing under a city requires this. */
  cityId?: InputMaybe<Scalars['ID']['input']>;
  /** Contact information for the facility. */
  contact: ContactInput;
  /** Google place id. Optional, and not a Places payload. */
  googlePlaceId?: InputMaybe<Scalars['String']['input']>;
  /** IDs of healthcare professionals to associate with this facility. */
  healthcareProfessionalIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /**
   * Latitude for map placement.
   * Required for a normal facility (a real pin, not 0). Omit for an online facility; stored as null.
   */
  mapLatitude?: InputMaybe<Scalars['Float']['input']>;
  /**
   * Longitude for map placement.
   * Required for a normal facility (a real pin, not 0). Omit for an online facility; stored as null.
   */
  mapLongitude?: InputMaybe<Scalars['Float']['input']>;
  /** Name of the facility in English. */
  nameEn: Scalars['String']['input'];
  /** Name of the facility in Japanese. */
  nameJa: Scalars['String']['input'];
  /**
   * Optional. Set true only for an online facility with no street address.
   * Omit or false for a normal facility. Defaults to false.
   * When true, address, city, and map may be omitted.
   */
  online?: InputMaybe<Scalars['Boolean']['input']>;
  /** Payment options for the facility, Type and Brand */
  paymentOptions?: InputMaybe<Array<PaymentOptionsInput>>;
  /** Where this facility record came from. */
  source?: InputMaybe<FacilitySource>;
  /** Published languages this facility advertises. Does not create a professional. */
  supportedLanguages?: InputMaybe<Array<Locale>>;
  /** CONFIRMED requires cityId. Omit this to leave an unresolved facility as UNVERIFIED_LOCATION. */
  verificationStatus?: InputMaybe<FacilityVerificationStatus>;
};

/** Input for creating a new healthcare professional. */
export type CreateHealthcareProfessionalInput = {
  /** Insurance types accepted. */
  acceptedInsurance?: InputMaybe<Array<Insurance>>;
  /** Free-text notes or instructions for patients. */
  additionalInfoForPatients?: InputMaybe<Scalars['String']['input']>;
  /** Academic or professional degrees held. */
  degrees?: InputMaybe<Array<Degree>>;
  /** IDs of facilities where this professional practices. */
  facilityIds: Array<Scalars['ID']['input']>;
  /** Localized names (e.g. English and Japanese). */
  names: Array<LocalizedNameInput>;
  /** Medical specialties practiced. */
  specialties?: InputMaybe<Array<Specialty>>;
  /** Languages the professional speaks. */
  spokenLanguages?: InputMaybe<Array<Locale>>;
};

/** Input for creating a new reservation. */
export type CreateReservationInput = {
  /** ID of the user making the reservation. */
  userId: Scalars['ID']['input'];
};

/** Input for creating a new community submission. */
export type CreateSubmissionInput = {
  /** Google Maps URL for the facility. */
  googleMapsUrl?: InputMaybe<Scalars['String']['input']>;
  /** Name of the healthcare professional being submitted. */
  healthcareProfessionalName?: InputMaybe<Scalars['String']['input']>;
  /** Optional notes from the submitter. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Languages spoken by the healthcare professional. */
  spokenLanguages?: InputMaybe<Array<Locale>>;
};

/** Input for creating a new user. */
export type CreateUserInput = {
  /** Display name shown in the UI. */
  displayName?: InputMaybe<Scalars['String']['input']>;
  /** URL of the user's profile picture. */
  profilePicUrl?: InputMaybe<Scalars['String']['input']>;
};

/** Auth roles and scopes for the GraphQL caller, as evaluated by the API (JWT + role mapping + production rules). */
export type CurrentUserAccess = {
  __typename?: 'CurrentUserAccess';
  /** Effective scopes used for API authorization (merged and filtered). */
  effectiveScopes: Array<Scalars['String']['output']>;
  /** Space-delimited OAuth scopes from the access token `scope` claim. */
  jwtScopes: Array<Scalars['String']['output']>;
  /** Application roles: Admin, Moderator, and so on from the token, plus FacilityOwner and FacilityStaff from claimed clinic memberships. */
  roles: Array<Scalars['String']['output']>;
};

/** Academic or professional degrees held by healthcare professionals. */
export enum Degree {
  /** Certified Nurse Midwife */
  Cnm = 'CNM',
  /** Doctor of Chiropractic */
  Dc = 'DC',
  /** Doctor of Dental Surgery */
  Dds = 'DDS',
  /** Doctor of Dental Medicine */
  Dmd = 'DMD',
  /** Doctor of Nursing Practice */
  Dnp = 'DNP',
  /** Doctor of Osteopathic Medicine */
  Do = 'DO',
  /** Doctor of Podiatric Medicine */
  Dpm = 'DPM',
  /** Doctor of Physical Therapy */
  Dpt = 'DPT',
  /** Doctor of Social Work */
  Dsw = 'DSW',
  /** Doctor of Science */
  DSc = 'DSc',
  /** Doctor of Veterinary Medicine */
  Dvm = 'DVM',
  /** Doctor of Education */
  EdD = 'EdD',
  /** Medical Doctor */
  Md = 'MD',
  /** Master of Public Health */
  Mph = 'MPH',
  /** Nurse Practitioner */
  Np = 'NP',
  /** Doctor of Optometry */
  Od = 'OD',
  /** Physician Assistant */
  Pa = 'PA',
  /** Doctor of Philosophy */
  PhD = 'PhD',
  /** Doctor of Pharmacy */
  PharmD = 'PharmD',
  /** Doctor of Psychology */
  PsyD = 'PsyD'
}

/** Result returned from delete mutations indicating success or failure. */
export type DeleteResult = {
  __typename?: 'DeleteResult';
  /** Whether the delete operation completed successfully. */
  isSuccessful: Scalars['Boolean']['output'];
};

/** A medical facility (hospital, clinic, etc.) registered in the Find a Doc database. */
export type Facility = {
  __typename?: 'Facility';
  /**
   * True once an admin or the clinic owner has saved booking settings for this facility.
   * The clinic page shows Book, and patients may book, only then.
   */
  bookingEnabled: Scalars['Boolean']['output'];
  /** The city record for cityId. Null when the facility has no city. */
  city?: Maybe<City>;
  /** City this facility is published under. Null until a city we own is chosen. */
  cityId?: Maybe<Scalars['ID']['output']>;
  /** Contact information for the facility. */
  contact: Contact;
  /** ISO 8601 timestamp of when this facility was created. */
  createdDate: Scalars['String']['output'];
  /** Google place id for this facility. Display fields are not stored from Places. */
  googlePlaceId?: Maybe<Scalars['String']['output']>;
  /** IDs of healthcare professionals associated with this facility. */
  healthcareProfessionalIds: Array<Scalars['ID']['output']>;
  /** Unique identifier for the facility. */
  id: Scalars['ID']['output'];
  /**
   * Latitude for map placement.
   * Null on an online facility (no street address / no pin).
   */
  mapLatitude?: Maybe<Scalars['Float']['output']>;
  /**
   * Longitude for map placement.
   * Null on an online facility (no street address / no pin).
   */
  mapLongitude?: Maybe<Scalars['Float']['output']>;
  /** Name of the facility in English. */
  nameEn: Scalars['String']['output'];
  /** Name of the facility in Japanese. */
  nameJa: Scalars['String']['output'];
  /**
   * True only when a moderator selected online (no street address).
   * Default is false. Address, city, and map are not required when true.
   */
  online: Scalars['Boolean']['output'];
  /** The payment methods accepted by this facility. */
  paymentOptions?: Maybe<Array<PaymentOption>>;
  /** Where the facility record came from. Null on rows that have not been classified. */
  source?: Maybe<FacilitySource>;
  /**
   * Languages this facility advertises without a named professional.
   * Only values from the published language list. Storing these does not create a healthcare professional.
   */
  supportedLanguages: Array<Locale>;
  /** ISO 8601 timestamp of the last update to this facility. */
  updatedDate: Scalars['String']['output'];
  /** Whether the location is confirmed. Unresolved rows are UNVERIFIED_LOCATION. */
  verificationStatus: FacilityVerificationStatus;
};

/** A live Google place a moderator can confirm. Do not store the name or address from this type. */
export type FacilityPlaceCandidate = {
  __typename?: 'FacilityPlaceCandidate';
  address?: Maybe<Scalars['String']['output']>;
  category?: Maybe<Scalars['String']['output']>;
  confidence: PlaceMatchConfidence;
  name?: Maybe<Scalars['String']['output']>;
  placeId: Scalars['String']['output'];
};

/** Search filters for querying facilities. All filters are combined with AND logic. */
export type FacilitySearchFilters = {
  /** Filter by contact information. */
  contact?: InputMaybe<ContactInput>;
  /** Filter by creation date (ISO 8601). */
  createdDate?: InputMaybe<Scalars['String']['input']>;
  /** Filter by associated healthcare professional IDs. */
  healthcareProfessionalIds?: InputMaybe<Array<Scalars['String']['input']>>;
  /** Filter by associated healthcare professional name. */
  healthcareProfessionalName?: InputMaybe<Scalars['String']['input']>;
  /** Maximum number of results to return. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by facility name in English (partial match). */
  nameEn?: InputMaybe<Scalars['String']['input']>;
  /** Filter by facility name in Japanese (partial match). */
  nameJa?: InputMaybe<Scalars['String']['input']>;
  /** Number of results to skip for pagination. */
  offset?: InputMaybe<Scalars['Int']['input']>;
  /** Ordering rules for the results. */
  orderBy?: InputMaybe<Array<OrderBy>>;
  /**
   * Filter by prefecture. Accepts an English prefecture key (e.g. "Okinawa", case-insensitive)
   * or the Japanese name (e.g. "沖縄県"). Unknown prefectures are rejected.
   */
  prefecture?: InputMaybe<Scalars['String']['input']>;
  /**
   * One text query matched against the English name, Japanese name, or id.
   * Applied before pagination. Blank leaves the list unfiltered.
   */
  query?: InputMaybe<Scalars['String']['input']>;
  /**
   * Only return facilities with at least one healthcare professional who practices all of these specialties.
   * Combined with spokenLanguages, the same professional must match both.
   */
  specialties?: InputMaybe<Array<Specialty>>;
  /**
   * Only return facilities that advertise every one of these languages.
   * A facility matches when supportedLanguages includes them all, or when one professional speaks them all.
   * Combined with specialties, the same professional must match both. Facility-level languages do not.
   */
  spokenLanguages?: InputMaybe<Array<Locale>>;
  /** Filter by last updated date (ISO 8601). */
  updatedDate?: InputMaybe<Scalars['String']['input']>;
};

/** Where a facility record came from. */
export enum FacilitySource {
  Manual = 'MANUAL',
  MhlwMultilingualInstitutions = 'MHLW_MULTILINGUAL_INSTITUTIONS'
}

/** Facility data embedded within a submission. */
export type FacilitySubmission = {
  __typename?: 'FacilitySubmission';
  /** Submitted contact information. */
  contact?: Maybe<Contact>;
  /** IDs of healthcare professionals associated with this facility. */
  healthcareProfessionalIds: Array<Scalars['ID']['output']>;
  /** ID of an existing facility, if this submission updates one. */
  id?: Maybe<Scalars['ID']['output']>;
  /** Submitted latitude coordinate. */
  mapLatitude?: Maybe<Scalars['Float']['output']>;
  /** Submitted longitude coordinate. */
  mapLongitude?: Maybe<Scalars['Float']['output']>;
  /** Submitted facility name in English. */
  nameEn?: Maybe<Scalars['String']['output']>;
  /** Submitted facility name in Japanese. */
  nameJa?: Maybe<Scalars['String']['output']>;
  /**
   * True when a moderator marked this facility as online (no street address).
   * Absent or false means a normal facility. Not set by the public form.
   */
  online?: Maybe<Scalars['Boolean']['output']>;
};

/** Location check for a facility. UNVERIFIED_LOCATION means there is no cityId. */
export enum FacilityVerificationStatus {
  Confirmed = 'CONFIRMED',
  Unverified = 'UNVERIFIED',
  UnverifiedLocation = 'UNVERIFIED_LOCATION'
}

/** A healthcare professional registered in the Find a Doc database. */
export type HealthcareProfessional = {
  __typename?: 'HealthcareProfessional';
  /** Insurance types accepted by this professional. */
  acceptedInsurance: Array<Insurance>;
  /** Credentials other than the clinical license, such as PhD or MPH. */
  additionalCredentials: Array<Degree>;
  /** Free-text notes or instructions for patients. */
  additionalInfoForPatients?: Maybe<Scalars['String']['output']>;
  /** ISO 8601 timestamp of when this record was created. */
  createdDate: Scalars['String']['output'];
  /** Academic or professional degrees held. */
  degrees: Array<Degree>;
  /** IDs of facilities where this professional practices. */
  facilityIds: Array<Scalars['ID']['output']>;
  /** Unique identifier for the healthcare professional. */
  id: Scalars['ID']['output'];
  /** Suggestion for a dual license. A moderator decides whether to apply it. */
  licenseRecommendation?: Maybe<Scalars['String']['output']>;
  /** NEEDS_REVIEW is the moderator queue. CONFIRMED keeps a dual license. */
  licenseReview?: Maybe<LicenseReviewStatus>;
  /** Localized names of the healthcare professional (e.g. English and Japanese). */
  names: Array<LocalizedName>;
  /** One clinical license. Empty while a dual license is unresolved or confirmed as dual. */
  primaryLicense?: Maybe<Degree>;
  /** Medical specialties practiced. */
  specialties: Array<Specialty>;
  /** Languages the healthcare professional speaks. */
  spokenLanguages: Array<Locale>;
  /** ISO 8601 timestamp of the last update to this record. */
  updatedDate: Scalars['String']['output'];
};

/** Search filters for querying healthcare professionals. All filters are combined with AND logic. */
export type HealthcareProfessionalSearchFilters = {
  /** Filter by accepted insurance types. */
  acceptedInsurance?: InputMaybe<Array<Insurance>>;
  /** Filter by creation date (ISO 8601). */
  createdDate?: InputMaybe<Scalars['String']['input']>;
  /** Filter by degrees. */
  degrees?: InputMaybe<Array<Degree>>;
  /** Filter to professionals linked to at least one of these facility IDs. */
  facilityIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Filter by specific healthcare professional IDs. */
  ids?: InputMaybe<Array<Scalars['ID']['input']>>;
  /** Only professionals in this license queue. NEEDS_REVIEW is the dual-license queue. */
  licenseReview?: InputMaybe<LicenseReviewStatus>;
  /** Maximum number of results to return. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Filter by localized names. */
  names?: InputMaybe<Array<LocalizedNameInput>>;
  /** Number of results to skip for pagination. */
  offset?: InputMaybe<Scalars['Int']['input']>;
  /** Ordering rules for the results. */
  orderBy?: InputMaybe<Array<OrderBy>>;
  /**
   * One text query matched against any localized given name, middle name, family name, or id.
   * Applied before pagination. Blank leaves the list unfiltered.
   */
  query?: InputMaybe<Scalars['String']['input']>;
  /** Filter by specialties. */
  specialties?: InputMaybe<Array<Specialty>>;
  /** Filter by spoken languages. */
  spokenLanguages?: InputMaybe<Array<Locale>>;
  /** Filter by last updated date (ISO 8601). */
  updatedDate?: InputMaybe<Scalars['String']['input']>;
};

/** Healthcare professional data embedded within a submission. */
export type HealthcareProfessionalSubmission = {
  __typename?: 'HealthcareProfessionalSubmission';
  /** Submitted accepted insurance types. */
  acceptedInsurance?: Maybe<Array<Insurance>>;
  /** Submitted free-text notes for patients. */
  additionalInfoForPatients?: Maybe<Scalars['String']['output']>;
  /** Submitted degrees. */
  degrees?: Maybe<Array<Degree>>;
  /** IDs of facilities where this professional practices. */
  facilityIds: Array<Scalars['ID']['output']>;
  /** ID of an existing healthcare professional, if this submission updates one. */
  id?: Maybe<Scalars['ID']['output']>;
  /** Submitted localized names. */
  names: Array<LocalizedName>;
  /** Submitted specialties. */
  specialties?: Maybe<Array<Specialty>>;
  /** Submitted spoken languages. */
  spokenLanguages: Array<Locale>;
};

/** Insurance types that healthcare professionals may accept. */
export enum Insurance {
  /** The provider does not accept any insurance. */
  InsuranceNotAccepted = 'INSURANCE_NOT_ACCEPTED',
  /** International or overseas health insurance plans. */
  InternationalHealthInsurance = 'INTERNATIONAL_HEALTH_INSURANCE',
  /** Japanese national health insurance (kokumin kenko hoken / shakai hoken). */
  JapaneseHealthInsurance = 'JAPANESE_HEALTH_INSURANCE',
  /** Travel insurance with medical coverage. */
  TravelInsurance = 'TRAVEL_INSURANCE',
  /** For patients without insurance coverage. */
  Uninsured = 'UNINSURED'
}

export type InviteClinicMemberInput = {
  email: Scalars['String']['input'];
  facilityId: Scalars['ID']['input'];
  role: ClinicMemberRole;
};

/** Moderator queue for a professional license. CONFIRMED keeps a dual license. */
export enum LicenseReviewStatus {
  /** A moderator confirmed that more than one clinical license should stay. */
  Confirmed = 'CONFIRMED',
  /** A moderator still needs to choose the primary license. */
  NeedsReview = 'NEEDS_REVIEW'
}

/** Language and region locale codes (BCP 47 style). Used to represent spoken languages. */
export enum Locale {
  /** Akan (Ghana) */
  AkGh = 'ak_GH',
  /** Amharic (Ethiopia) */
  AmEt = 'am_ET',
  /** Arabic (United Arab Emirates) */
  ArAe = 'ar_AE',
  /** Bambara (Mali) */
  BmMl = 'bm_ML',
  /** Bengali (Bangladesh) */
  BnBd = 'bn_BD',
  /** Bosnian (Bosnia and Herzegovina) */
  BsBa = 'bs_BA',
  /** Catalan (Spain) */
  CaEs = 'ca_ES',
  /** Cherokee (United States) */
  ChrUs = 'chr_US',
  /** Czech (Czech Republic) */
  CsCz = 'cs_CZ',
  /** Welsh (United Kingdom) */
  CyGb = 'cy_GB',
  /** Danish (Denmark) */
  DaDk = 'da_DK',
  /** German (Germany) */
  DeDe = 'de_DE',
  /** Ewe (Ghana) */
  EeGh = 'ee_GH',
  /** Greek (Greece) */
  ElGr = 'el_GR',
  /** English (United States) */
  EnUs = 'en_US',
  /** Spanish (Spain) */
  EsEs = 'es_ES',
  /** Estonian (Estonia) */
  EtEe = 'et_EE',
  /** Persian (Afghanistan) */
  FaAf = 'fa_AF',
  /** Finnish (Finland) */
  FiFi = 'fi_FI',
  /** French (France) */
  FrFr = 'fr_FR',
  /** Gusii (Kenya) */
  GuzKe = 'guz_KE',
  /** Hebrew (Israel) */
  HeIl = 'he_IL',
  /** Hindi (India) */
  HiIn = 'hi_IN',
  /** Croatian (Croatia) */
  HrHr = 'hr_HR',
  /** Hungarian (Hungary) */
  HuHu = 'hu_HU',
  /** Armenian (Armenia) */
  HyAm = 'hy_AM',
  /** Indonesian (Indonesia) */
  IdId = 'id_ID',
  /** Igbo (Nigeria) */
  IgNg = 'ig_NG',
  /** Icelandic (Iceland) */
  IsIs = 'is_IS',
  /** Italian (Italy) */
  ItIt = 'it_IT',
  /** Japanese (Japan) */
  JaJp = 'ja_JP',
  /** Kabyle (Algeria) */
  KabDz = 'kab_DZ',
  /** Khmer (Cambodia) */
  KmKh = 'km_KH',
  /** Kannada (India) */
  KnIn = 'kn_IN',
  /** Korean (South Korea) */
  KoKr = 'ko_KR',
  /** Langi (Tanzania) */
  LagTz = 'lag_TZ',
  /** Ganda (Uganda) */
  LgUg = 'lg_UG',
  /** Latvian (Latvia) */
  LvLv = 'lv_LV',
  /** Mongolian (Mongolia) */
  MnMn = 'mn_MN',
  /** Norwegian Bokmal (Norway) */
  NbNo = 'nb_NO',
  /** Nepali (Nepal) */
  NeNp = 'ne_NP',
  /** Dutch (Belgium) */
  NlBe = 'nl_BE',
  /** Polish (Poland) */
  PlPl = 'pl_PL',
  /** Portuguese (Brazil) */
  PtBr = 'pt_BR',
  /** Russian (Russia) */
  RuRu = 'ru_RU',
  /** Sinhala (Sri Lanka) */
  SiLk = 'si_LK',
  /** Albanian (Albania) */
  SqAl = 'sq_AL',
  /** Serbian (Cyrillic) */
  SrCyrl = 'sr_Cyrl',
  /** Swahili (Kenya) */
  SwKe = 'sw_KE',
  /** Thai (Thailand) */
  ThTh = 'th_TH',
  /** Tagalog (Philippines) */
  TlPh = 'tl_PH',
  /** Turkish (Turkey) */
  TrTr = 'tr_TR',
  /** Unspecified Language (Undefined) */
  Und = 'und',
  /** Vietnamese (Vietnam) */
  ViVn = 'vi_VN',
  /** Chinese (Simplified, China) */
  ZhCn = 'zh_CN',
  /** Chinese (Traditional, Hong Kong SAR China) */
  ZhHk = 'zh_HK',
  /** Chinese (Traditional, Taiwan) */
  ZhTw = 'zh_TW'
}

/** A person's name localized to a specific language/locale. */
export type LocalizedName = {
  __typename?: 'LocalizedName';
  /** First (given) name. */
  firstName: Scalars['String']['output'];
  /** Last (family) name. */
  lastName: Scalars['String']['output'];
  /** The locale this name is written in. */
  locale: Locale;
  /** Middle name, if applicable. */
  middleName?: Maybe<Scalars['String']['output']>;
};

/** Input for providing a localized name. */
export type LocalizedNameInput = {
  /** First (given) name. */
  firstName: Scalars['String']['input'];
  /** Last (family) name. */
  lastName: Scalars['String']['input'];
  /** The locale this name is written in. */
  locale: Locale;
  /** Middle name, if applicable. */
  middleName?: InputMaybe<Scalars['String']['input']>;
};

/** Live place details for the submit form. Do not store the name, address, or category. */
export type MapsPlacePreview = {
  __typename?: 'MapsPlacePreview';
  address?: Maybe<Scalars['String']['output']>;
  /** Short place type, such as Medical clinic. */
  category?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  placeId?: Maybe<Scalars['String']['output']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  /**
   * Short-lived GET URL for a booking upload. Identity files are never inlined in GraphQL.
   * INLINE (the default) opens the file in the browser; ATTACHMENT saves a copy.
   */
  bookingUploadDownloadUrl: BookingUploadDownloadUrl;
  /** The patient cancels with the private token from the email link. Frees the slot. */
  cancelBookingByToken: PatientBookingView;
  /**
   * Store a Google place id a moderator confirmed.
   * The facility name and address are not changed.
   */
  confirmFacilityPlaceId: Facility;
  /**
   * Create a short-lived upload URL for one booking file field.
   * The browser uploads the file, then passes uploadId to submitBooking.
   */
  createBookingUploadUrl: BookingUploadUrl;
  /** Close a range on the clinic calendar. Appointments already in it are unchanged. */
  createClinicAvailabilityClosure: ClinicAvailabilityClosure;
  /** Paint a 30-minute-aligned availability window on the clinic calendar. */
  createClinicAvailabilityWindow: ClinicAvailabilityWindow;
  /** Create a new facility record. */
  createFacility: Facility;
  /** Create a new healthcare professional record. */
  createHealthcareProfessional: HealthcareProfessional;
  /** Create a new reservation. */
  createReservation: Reservation;
  /** Create a new community submission for a healthcare professional or facility. */
  createSubmission: Submission;
  /** Create a new user account. */
  createUser: User;
  /** Reopen a closed range. */
  deleteClinicAvailabilityClosure: DeleteResult;
  /** Remove one availability window. Existing appointments are unchanged. */
  deleteClinicAvailabilityWindow: DeleteResult;
  /** Delete a facility by ID. */
  deleteFacility: DeleteResult;
  /** Delete a healthcare professional by ID. */
  deleteHealthcareProfessional: DeleteResult;
  /** Delete a submission by ID. */
  deleteSubmission: DeleteResult;
  /** Invite an email to one clinic. Admins invite anyone; an owner invites staff. */
  inviteClinicMember: ClinicMember;
  /** Store a city place id. Does not store a Places name, address, or coordinate. */
  recordCityPlaceId: City;
  /** Remove a clinic member. Admins remove anyone; an owner removes staff. */
  removeClinicMember: DeleteResult;
  /** Replace the clinic's usual week. Members and moderators. */
  setClinicWeeklyHours: Array<ClinicWeeklyHours>;
  /**
   * Submit a clinic booking form.
   * Sends a SES notification when email is configured; otherwise records the row only.
   */
  submitBooking: BookingSubmissionResult;
  /** Staff confirm, decline, cancel, or complete an appointment. Declined and cancelled free the slot. */
  updateBookingAppointmentStatus: BookingAppointment;
  /** Change visit lengths and offered forms. Owners and admins. */
  updateBookingSettings: BookingSettings;
  /** Update an existing facility by ID. */
  updateFacility: Facility;
  /** Update an existing healthcare professional by ID. */
  updateHealthcareProfessional: HealthcareProfessional;
  /** Update an existing reservation. */
  updateReservation: Reservation;
  /** Update an existing submission by ID. */
  updateSubmission: Submission;
  /** Update an existing user by ID. */
  updateUser: User;
};


export type MutationBookingUploadDownloadUrlArgs = {
  disposition?: InputMaybe<BookingUploadDisposition>;
  uploadId: Scalars['ID']['input'];
};


export type MutationCancelBookingByTokenArgs = {
  input: CancelBookingByTokenInput;
};


export type MutationConfirmFacilityPlaceIdArgs = {
  facilityId: Scalars['ID']['input'];
  placeId: Scalars['String']['input'];
};


export type MutationCreateBookingUploadUrlArgs = {
  input: CreateBookingUploadUrlInput;
};


export type MutationCreateClinicAvailabilityClosureArgs = {
  input: CreateClinicAvailabilityClosureInput;
};


export type MutationCreateClinicAvailabilityWindowArgs = {
  input: CreateClinicAvailabilityWindowInput;
};


export type MutationCreateFacilityArgs = {
  input: CreateFacilityInput;
};


export type MutationCreateHealthcareProfessionalArgs = {
  input: CreateHealthcareProfessionalInput;
};


export type MutationCreateReservationArgs = {
  input: CreateReservationInput;
};


export type MutationCreateSubmissionArgs = {
  input: CreateSubmissionInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationDeleteClinicAvailabilityClosureArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteClinicAvailabilityWindowArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteFacilityArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteHealthcareProfessionalArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteSubmissionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationInviteClinicMemberArgs = {
  input: InviteClinicMemberInput;
};


export type MutationRecordCityPlaceIdArgs = {
  cityId: Scalars['ID']['input'];
  placeId: Scalars['String']['input'];
};


export type MutationRemoveClinicMemberArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSetClinicWeeklyHoursArgs = {
  input: SetClinicWeeklyHoursInput;
};


export type MutationSubmitBookingArgs = {
  input: SubmitBookingInput;
};


export type MutationUpdateBookingAppointmentStatusArgs = {
  input: UpdateBookingAppointmentStatusInput;
};


export type MutationUpdateBookingSettingsArgs = {
  input: UpdateBookingSettingsInput;
};


export type MutationUpdateFacilityArgs = {
  id: Scalars['ID']['input'];
  input: UpdateFacilityInput;
};


export type MutationUpdateHealthcareProfessionalArgs = {
  id: Scalars['ID']['input'];
  input: UpdateHealthcareProfessionalInput;
};


export type MutationUpdateReservationArgs = {
  input: UpdateReservationInput;
};


export type MutationUpdateSubmissionArgs = {
  id: Scalars['ID']['input'];
  input: UpdateSubmissionInput;
};


export type MutationUpdateUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};

/** The type of entity affected by an audited action. */
export enum ObjectType {
  /** A facility entity. */
  Facility = 'Facility',
  /** A healthcare professional entity. */
  HealthcareProfessional = 'HealthcareProfessional',
  /** A submission entity. */
  Submission = 'Submission'
}

/** Specifies a field and direction to order query results by. */
export type OrderBy = {
  /** The name of the field to sort by (e.g. 'createdDate', 'nameEn'). */
  fieldToOrder: Scalars['String']['input'];
  /** The direction to sort (ascending or descending). */
  orderDirection: OrderDirection;
};

/** Sort direction for ordering query results. */
export enum OrderDirection {
  /** Ascending order (A-Z, oldest first, lowest first). */
  Asc = 'asc',
  /** Descending order (Z-A, newest first, highest first). */
  Desc = 'desc'
}

/** What the patient sees on the private cancel page. No answers are returned. */
export type PatientBookingView = {
  __typename?: 'PatientBookingView';
  canCancel: Scalars['Boolean']['output'];
  clinicName: Scalars['String']['output'];
  endsAt?: Maybe<Scalars['String']['output']>;
  startsAt?: Maybe<Scalars['String']['output']>;
  status?: Maybe<BookingAppointmentStatus>;
};

/** Represents a payment method accepted at a healthcare facility. */
export type PaymentOption = {
  __typename?: 'PaymentOption';
  /** Specific brands or networks accepted (e.g., 'Visa', 'Mastercard', 'Suica', 'PayPay'). */
  paymentBrands?: Maybe<Array<Scalars['String']['output']>>;
  /** The general category of payment (e.g., 'Credit Card', 'Cash', 'Electronic Money'). */
  paymentType: PaymentType;
};

/** Payment Options input for adding facility  */
export type PaymentOptionsInput = {
  paymentBrands?: InputMaybe<Array<Scalars['String']['input']>>;
  paymentType: PaymentType;
};

/** List of payment types for healthcare facilities */
export enum PaymentType {
  Cash = 'CASH',
  CreditCard = 'CREDIT_CARD',
  DebitCard = 'DEBIT_CARD',
  ElectronicMoney = 'ELECTRONIC_MONEY',
  Insurance = 'INSURANCE',
  QrCode = 'QR_CODE'
}

/** A physical address with bilingual (English and Japanese) fields. */
export type PhysicalAddress = {
  __typename?: 'PhysicalAddress';
  /** Primary address line in English. */
  addressLine1En: Scalars['String']['output'];
  /** Primary address line in Japanese. */
  addressLine1Ja: Scalars['String']['output'];
  /** Secondary address line in English (e.g. building, floor). */
  addressLine2En?: Maybe<Scalars['String']['output']>;
  /** Secondary address line in Japanese (e.g. building, floor). */
  addressLine2Ja?: Maybe<Scalars['String']['output']>;
  /** City name in English. */
  cityEn: Scalars['String']['output'];
  /** City name in Japanese. */
  cityJa: Scalars['String']['output'];
  /** Postal / zip code. */
  postalCode: Scalars['String']['output'];
  /** Prefecture name in English. */
  prefectureEn: Scalars['String']['output'];
  /** Prefecture name in Japanese. */
  prefectureJa: Scalars['String']['output'];
};

/** Input for providing a physical address with bilingual fields. */
export type PhysicalAddressInput = {
  /** Primary address line in English. */
  addressLine1En: Scalars['String']['input'];
  /** Primary address line in Japanese. */
  addressLine1Ja: Scalars['String']['input'];
  /** Secondary address line in English (e.g. building, floor). */
  addressLine2En: Scalars['String']['input'];
  /** Secondary address line in Japanese (e.g. building, floor). */
  addressLine2Ja: Scalars['String']['input'];
  /** City name in English. */
  cityEn: Scalars['String']['input'];
  /** City name in Japanese. */
  cityJa: Scalars['String']['input'];
  /** Postal / zip code. */
  postalCode: Scalars['String']['input'];
  /** Prefecture name in English. */
  prefectureEn: Scalars['String']['input'];
  /** Prefecture name in Japanese. */
  prefectureJa: Scalars['String']['input'];
};

export enum PlaceMatchConfidence {
  High = 'HIGH',
  Low = 'LOW'
}

/** A prefecture from the frozen key list. */
export type Prefecture = {
  __typename?: 'Prefecture';
  id: Scalars['ID']['output'];
  /** English key, for example Tokyo or Hyogo. */
  nameEn: Scalars['String']['output'];
  /** Japanese name, including 都, 道, 府, or 県. */
  nameJa: Scalars['String']['output'];
  /** Lowercase English key. */
  slug: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** Look up a single audit log entry by its ID. Returns null if not found. */
  auditLog?: Maybe<AuditLog>;
  /**
   * Open appointment starts that fit the requested duration inside staff availability.
   * Times are ISO 8601 UTC. The range must be 16 days or shorter.
   * With practitionerId, only that doctor's times. Without it, times any doctor who
   * speaks every language in spokenLanguages has free, plus clinic time.
   */
  availableBookingStarts: Array<Scalars['String']['output']>;
  /**
   * Whether this visitor may send a booking request. Booking is offered only to people
   * in Japan (CloudFront's viewer country). Always true in local development and tests.
   * submitBooking and createBookingUploadUrl refuse with BOOKING_REGION_UNAVAILABLE otherwise.
   */
  bookingAvailable: Scalars['Boolean']['output'];
  /** One clinic for the dashboard header. Null when the user may not open it. */
  bookingClinic?: Maybe<BookingClinic>;
  /** Every clinic set up for booking, for the admin clinic picker. Admins only. */
  bookingClinics: Array<BookingClinic>;
  /**
   * The booking intake form for a directory facility or hosted clinic.
   * Pass a facility id, clinic site id, or slug. Unknown clinics are null.
   * Open to a signed-out visitor. create:bookings is on the anonymous user role.
   */
  bookingForm?: Maybe<BookingForm>;
  /** Intake form types a clinic may offer. */
  bookingFormTypes: Array<BookingFormType>;
  /** Booking options for one clinic. Members and admins. */
  bookingSettings?: Maybe<BookingSettings>;
  /** Staff read-only detail for one booking submission. */
  bookingSubmission?: Maybe<BookingSubmissionDetail>;
  /**
   * Staff list of booking submissions, limited to the clinics the user belongs to.
   * Admins see every clinic.
   */
  bookingSubmissions: Array<BookingSubmissionListItem>;
  bookingSubmissionsTotalCount: Scalars['Int']['output'];
  /** Every current municipality. Pass a prefecture key or Japanese name to filter. */
  cities: Array<City>;
  /** Facilities published under one city. Unresolved locations are excluded. */
  cityFacilities: Array<Facility>;
  /** Appointments on one clinic calendar. The range must be 62 days or shorter. */
  clinicAppointments: Array<BookingAppointment>;
  /** Closures on one clinic calendar. The range must be 62 days or shorter. */
  clinicAvailabilityClosures: Array<ClinicAvailabilityClosure>;
  /** Staff availability windows for the calendar editor. */
  clinicAvailabilityWindows: Array<ClinicAvailabilityWindow>;
  /** Invited and signed-in members of one clinic. Owners and admins only. */
  clinicMembers: Array<ClinicMember>;
  /** Doctors at one clinic, for the schedule picker. Members and admins. */
  clinicPractitioners: Array<BookingPractitioner>;
  /** A hosted clinic page. Drafts are null. The clean link is /clinic/{slug}. */
  clinicSite?: Maybe<ClinicSite>;
  /** Hosted clinics that are in preview or published. Drafts are omitted. */
  clinicSites: Array<ClinicSiteSummary>;
  /** Every schedule's usual week in Japan time. Members and admins. */
  clinicWeeklyHours: Array<ClinicWeeklyHours>;
  /** Roles and effective API scopes for the authenticated user (always allowed when a user context exists). */
  currentUserAccess: CurrentUserAccess;
  /** Search for facilities matching the given filters. Returns an empty list if no matches. */
  facilities: Array<Facility>;
  /** Get the total count of facilities matching the given filters. Useful for pagination. */
  facilitiesTotalCount: Scalars['Int']['output'];
  /** Look up a single facility by its unique ID. Returns null if not found. */
  facility?: Maybe<Facility>;
  /**
   * The facility that already stores this Google place id.
   * Null when the id is unknown or we have no matching row.
   */
  facilityByGooglePlaceId?: Maybe<Facility>;
  /**
   * The clinic this Maps link already is.
   * A short iPhone link, a place id, and a feature id are the same check.
   * Null when the link does not match one clinic.
   */
  facilityMatchingMapsUrl?: Maybe<Facility>;
  /** Look up a single healthcare professional by their unique ID. Returns null if not found. */
  healthcareProfessional?: Maybe<HealthcareProfessional>;
  /** Search for healthcare professionals matching the given filters. Returns an empty list if no matches. */
  healthcareProfessionals: Array<HealthcareProfessional>;
  /** Get the total count of healthcare professionals matching the given filters. Useful for pagination. */
  healthcareProfessionalsTotalCount: Scalars['Int']['output'];
  /**
   * Live name, address, and category for a Maps link on the submit form.
   * Nothing in this response is saved.
   */
  mapsPlacePreview?: Maybe<MapsPlacePreview>;
  /** Clinics the signed-in user belongs to. Claims a pending invite for a verified email. */
  myBookingClinics: Array<BookingClinic>;
  /** The patient's own booking, found by the private token from the email link. */
  patientBooking?: Maybe<PatientBookingView>;
  /** Prefectures this server owns. One row per prefecture in the frozen key list. */
  prefectures: Array<Prefecture>;
  /** Languages a search facet may offer. This is the published allowlist, not every Locale value. */
  publishedLanguages: Array<Locale>;
  /** Look up a single reservation by its unique ID. Returns null if not found. */
  reservation?: Maybe<Reservation>;
  /** Look up a single submission by its unique ID. Returns null if not found. */
  submission?: Maybe<Submission>;
  /** Search for submissions matching the given filters. Returns an empty list if no matches. */
  submissions: Array<Submission>;
  /** Get the total count of submissions matching the given filters. Useful for pagination. */
  submissionsTotalCount: Scalars['Int']['output'];
  /**
   * Japan-only city suggestions from Places. The label is live Google text for this screen.
   * Do not store it. A suggestion with no city is not in our vocabulary.
   */
  suggestCities: Array<CitySuggestion>;
  /**
   * Live place candidates for a moderator. Nothing in this list is saved.
   * A coordinate by itself is not a match.
   */
  suggestFacilityPlaces: Array<FacilityPlaceCandidate>;
  /** Look up a single user by their unique ID. Returns null if not found. */
  user?: Maybe<User>;
};


export type QueryAuditLogArgs = {
  id?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryAvailableBookingStartsArgs = {
  clinicSiteId: Scalars['ID']['input'];
  durationMinutes?: InputMaybe<Scalars['Int']['input']>;
  from: Scalars['String']['input'];
  practitionerId?: InputMaybe<Scalars['ID']['input']>;
  spokenLanguages?: InputMaybe<Array<Locale>>;
  to: Scalars['String']['input'];
};


export type QueryBookingClinicArgs = {
  facilityId: Scalars['ID']['input'];
};


export type QueryBookingFormArgs = {
  clinicSiteId: Scalars['ID']['input'];
  formId?: InputMaybe<Scalars['String']['input']>;
};


export type QueryBookingSettingsArgs = {
  facilityId: Scalars['ID']['input'];
};


export type QueryBookingSubmissionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryBookingSubmissionsArgs = {
  filters: BookingSubmissionSearchFilters;
};


export type QueryBookingSubmissionsTotalCountArgs = {
  filters: BookingSubmissionSearchFilters;
};


export type QueryCitiesArgs = {
  prefecture?: InputMaybe<Scalars['String']['input']>;
};


export type QueryCityFacilitiesArgs = {
  citySlug: Scalars['String']['input'];
  prefecture: Scalars['String']['input'];
};


export type QueryClinicAppointmentsArgs = {
  clinicId: Scalars['ID']['input'];
  from: Scalars['String']['input'];
  to: Scalars['String']['input'];
};


export type QueryClinicAvailabilityClosuresArgs = {
  clinicId: Scalars['ID']['input'];
  from: Scalars['String']['input'];
  to: Scalars['String']['input'];
};


export type QueryClinicAvailabilityWindowsArgs = {
  clinicSiteId: Scalars['ID']['input'];
  from: Scalars['String']['input'];
  to: Scalars['String']['input'];
};


export type QueryClinicMembersArgs = {
  facilityId: Scalars['ID']['input'];
};


export type QueryClinicPractitionersArgs = {
  clinicId: Scalars['ID']['input'];
};


export type QueryClinicSiteArgs = {
  slug: Scalars['String']['input'];
};


export type QueryClinicWeeklyHoursArgs = {
  clinicId: Scalars['ID']['input'];
};


export type QueryFacilitiesArgs = {
  filters: FacilitySearchFilters;
};


export type QueryFacilitiesTotalCountArgs = {
  filters: FacilitySearchFilters;
};


export type QueryFacilityArgs = {
  id: Scalars['ID']['input'];
};


export type QueryFacilityByGooglePlaceIdArgs = {
  placeId: Scalars['String']['input'];
};


export type QueryFacilityMatchingMapsUrlArgs = {
  url: Scalars['String']['input'];
};


export type QueryHealthcareProfessionalArgs = {
  id: Scalars['ID']['input'];
};


export type QueryHealthcareProfessionalsArgs = {
  filters: HealthcareProfessionalSearchFilters;
};


export type QueryHealthcareProfessionalsTotalCountArgs = {
  filters: HealthcareProfessionalSearchFilters;
};


export type QueryMapsPlacePreviewArgs = {
  languageCode?: InputMaybe<Scalars['String']['input']>;
  url: Scalars['String']['input'];
};


export type QueryPatientBookingArgs = {
  token: Scalars['String']['input'];
};


export type QueryReservationArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySubmissionArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySubmissionsArgs = {
  filters: SubmissionSearchFilters;
};


export type QuerySubmissionsTotalCountArgs = {
  filters: SubmissionSearchFilters;
};


export type QuerySuggestCitiesArgs = {
  input: Scalars['String']['input'];
};


export type QuerySuggestFacilityPlacesArgs = {
  address?: InputMaybe<Scalars['String']['input']>;
  languageCode?: InputMaybe<Scalars['String']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  nameEn?: InputMaybe<Scalars['String']['input']>;
  nameJa?: InputMaybe<Scalars['String']['input']>;
  url?: InputMaybe<Scalars['String']['input']>;
};


export type QueryUserArgs = {
  id: Scalars['ID']['input'];
};

/** Describes a relationship change for an ID in a list — whether to add, update, or remove it. */
export type Relationship = {
  /** The action to perform on this relationship. */
  action: RelationshipAction;
  /** The ID of the related entity. */
  otherEntityId: Scalars['ID']['input'];
};

/** The action to perform on a relationship between entities. */
export enum RelationshipAction {
  /** Add a new relationship. */
  Create = 'CREATE',
  /** Remove the relationship. */
  Delete = 'DELETE',
  /** Update an existing relationship. */
  Update = 'UPDATE'
}

/** A reservation made by a user (e.g. for an appointment). */
export type Reservation = {
  __typename?: 'Reservation';
  /** ISO 8601 timestamp of when this reservation was created. */
  createdDate: Scalars['String']['output'];
  /** Unique identifier for the reservation. */
  id: Scalars['ID']['output'];
  /** Current status of the reservation. */
  status: ReservationStatus;
  /** ISO 8601 timestamp of the last update to this reservation. */
  updatedDate: Scalars['String']['output'];
  /** ID of the user who made this reservation. */
  userId: Scalars['ID']['output'];
};

/** The current status of a reservation. */
export enum ReservationStatus {
  /** The reservation is confirmed and active. */
  Booked = 'BOOKED',
  /** The reservation has been cancelled. */
  Cancelled = 'CANCELLED',
  /** The reservation has been fulfilled. */
  Completed = 'COMPLETED'
}

/** The schema version used for audit log serialization. */
export enum SchemaVersion {
  /** Version 1 of the audit log schema. */
  V1 = 'V1'
}

export type SetClinicWeeklyHoursInput = {
  /** Facility id, clinic site id, or clinic site slug. */
  facilityId: Scalars['ID']['input'];
  /** The whole week. Blocks that overlap or touch on one day are joined. */
  hours: Array<ClinicWeeklyHoursInput>;
  /** A doctor at this clinic. Null sets the clinic's own week. Other schedules are unchanged. */
  practitionerId?: InputMaybe<Scalars['ID']['input']>;
};

/** Medical specialties that a healthcare professional may practice. */
export enum Specialty {
  /** Allergy and Immunology */
  AllergyAndImmunology = 'ALLERGY_AND_IMMUNOLOGY',
  /** Anesthesiology */
  Anesthesiology = 'ANESTHESIOLOGY',
  /** Cardiology */
  Cardiology = 'CARDIOLOGY',
  /** Cosmetic Surgery */
  CosmeticSurgery = 'COSMETIC_SURGERY',
  /** Dentistry */
  Dentistry = 'DENTISTRY',
  /** Dermatology */
  Dermatology = 'DERMATOLOGY',
  /** Diagnostic Radiology */
  DiagnosticRadiology = 'DIAGNOSTIC_RADIOLOGY',
  /** Emergency Medicine */
  EmergencyMedicine = 'EMERGENCY_MEDICINE',
  /** Ear, Nose, and Throat (ENT) */
  EntSpecialist = 'ENT_SPECIALIST',
  /** Family Medicine */
  FamilyMedicine = 'FAMILY_MEDICINE',
  /** General Medicine */
  GeneralMedicine = 'GENERAL_MEDICINE',
  /** Infectious Diseases */
  InfectiousDiseases = 'INFECTIOUS_DISEASES',
  /** Internal Medicine */
  InternalMedicine = 'INTERNAL_MEDICINE',
  /** Medical Genetics */
  MedicalGenetics = 'MEDICAL_GENETICS',
  /** Neurology */
  Neurology = 'NEUROLOGY',
  /** Nuclear Medicine */
  NuclearMedicine = 'NUCLEAR_MEDICINE',
  /** Obstetrics and Gynecology */
  ObstetricsAndGynecology = 'OBSTETRICS_AND_GYNECOLOGY',
  /** Ophthalmology */
  Ophthalmology = 'OPHTHALMOLOGY',
  /** Optometry */
  Optometry = 'OPTOMETRY',
  /** Orthodontics */
  Orthodontics = 'ORTHODONTICS',
  /** Orthopedic Surgery */
  OrthopedicSurgery = 'ORTHOPEDIC_SURGERY',
  /** Otolaryngology */
  Otolaryngology = 'OTOLARYNGOLOGY',
  /** Pathology */
  Pathology = 'PATHOLOGY',
  /** Pediatrics */
  Pediatrics = 'PEDIATRICS',
  /** Pharmacy */
  Pharmacy = 'PHARMACY',
  /** Physical Medicine and Rehabilitation */
  PhysicalMedicineAndRehabilitation = 'PHYSICAL_MEDICINE_AND_REHABILITATION',
  /** Physiotherapy */
  Physiotherapy = 'PHYSIOTHERAPY',
  /** Plastic Surgery */
  PlasticSurgery = 'PLASTIC_SURGERY',
  /** Preventive Medicine */
  PreventiveMedicine = 'PREVENTIVE_MEDICINE',
  /** Proctology */
  Proctology = 'PROCTOLOGY',
  /** Psychiatry */
  Psychiatry = 'PSYCHIATRY',
  /** Radiation Oncology */
  RadiationOncology = 'RADIATION_ONCOLOGY',
  /** Sports Medicine */
  SportsMedicine = 'SPORTS_MEDICINE',
  /** General Surgery */
  Surgery = 'SURGERY',
  /** Traumatology */
  Traumatology = 'TRAUMATOLOGY',
  /** Urology */
  Urology = 'UROLOGY'
}

/** Grouping categories for medical specialties, used for filtering in the UI. */
export enum SpecialtyCategory {
  /** Children's health and pediatric specialties. */
  ChildrensHealth = 'CHILDRENS_HEALTH',
  /** Cosmetic and plastic surgery specialties. */
  CosmeticAndPlasticSurgery = 'COSMETIC_AND_PLASTIC_SURGERY',
  /** Dental specialties. */
  Dental = 'DENTAL',
  /** Dermatology specialties. */
  Dermatology = 'DERMATOLOGY',
  /** Ear, Nose, and Throat specialties. */
  Ent = 'ENT',
  /** Eye and vision care specialties. */
  EyeAndVision = 'EYE_AND_VISION',
  /** Men's health specialties. */
  MensHealth = 'MENS_HEALTH',
  /** Mental health specialties. */
  MentalHealth = 'MENTAL_HEALTH',
  /** Physical therapy specialties. */
  PhysicalTherapy = 'PHYSICAL_THERAPY',
  /** Primary care specialties. */
  PrimaryCare = 'PRIMARY_CARE',
  /** Sports medicine and rehabilitation specialties. */
  SportsAndRehab = 'SPORTS_AND_REHAB',
  /** Women's health specialties. */
  WomensHealth = 'WOMENS_HEALTH'
}

/** A community-submitted suggestion for adding or updating a healthcare professional or facility. */
export type Submission = {
  __typename?: 'Submission';
  /** ISO 8601 timestamp of when this submission was created. */
  createdDate: Scalars['String']['output'];
  /** Facility data included in this submission. */
  facility?: Maybe<FacilitySubmission>;
  /** Google Maps URL for the facility associated with this submission. */
  googleMapsUrl: Scalars['String']['output'];
  /** Name of the healthcare professional being submitted. */
  healthcareProfessionalName: Scalars['String']['output'];
  /** Healthcare professional data included in this submission. */
  healthcareProfessionals?: Maybe<Array<HealthcareProfessionalSubmission>>;
  /** Unique identifier for the submission. */
  id: Scalars['ID']['output'];
  /** Whether this submission has been approved by a moderator. */
  isApproved: Scalars['Boolean']['output'];
  /** Whether this submission has been rejected by a moderator. */
  isRejected: Scalars['Boolean']['output'];
  /** Whether this submission is currently under review by a moderator. */
  isUnderReview: Scalars['Boolean']['output'];
  /** Optional notes from the submitter or moderator. */
  notes?: Maybe<Scalars['String']['output']>;
  /** Languages spoken by the submitted healthcare professional. */
  spokenLanguages: Array<Locale>;
  /** ISO 8601 timestamp of the last update to this submission. */
  updatedDate: Scalars['String']['output'];
};

/** Search filters for querying submissions. All filters are combined with AND logic. */
export type SubmissionSearchFilters = {
  /** Filter by creation date (ISO 8601). */
  createdDate?: InputMaybe<Scalars['String']['input']>;
  /** Filter by Google Maps URL. */
  googleMapsUrl?: InputMaybe<Scalars['String']['input']>;
  /** Filter by healthcare professional name. */
  healthcareProfessionalName?: InputMaybe<Scalars['String']['input']>;
  /** Filter to approved submissions. */
  isApproved?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter to rejected submissions. */
  isRejected?: InputMaybe<Scalars['Boolean']['input']>;
  /** Filter to submissions under review. */
  isUnderReview?: InputMaybe<Scalars['Boolean']['input']>;
  /** Maximum number of results to return. */
  limit?: InputMaybe<Scalars['Int']['input']>;
  /** Number of results to skip for pagination. */
  offset?: InputMaybe<Scalars['Int']['input']>;
  /** Ordering rules for the results. */
  orderBy?: InputMaybe<Array<OrderBy>>;
  /** Filter by spoken languages. */
  spokenLanguages?: InputMaybe<Array<Locale>>;
  /** Filter by last updated date (ISO 8601). */
  updatedDate?: InputMaybe<Scalars['String']['input']>;
};

export type SubmitBookingInput = {
  answers: Array<BookingAnswerInput>;
  /** Facility id, clinic site id, or clinic site slug. */
  clinicSiteId: Scalars['ID']['input'];
  /** The patient ticked "I am currently in Japan". Must be true. */
  confirmedInJapan: Scalars['Boolean']['input'];
  /** Visit length in minutes. Must be one of the clinic's allowedDurations. */
  durationMinutes?: InputMaybe<Scalars['Int']['input']>;
  formDefinitionId: Scalars['String']['input'];
  formVersion: Scalars['Int']['input'];
  /**
   * The patient consented to the reason for the visit being sent to the clinic.
   * Must be true. The consent time is stored with the request.
   */
  healthDataConsent: Scalars['Boolean']['input'];
  locale: Scalars['String']['input'];
  /**
   * Optional directory professional id at this facility. With no id, the visit goes
   * to a free doctor who speaks every language in spokenLanguages, or to clinic time.
   */
  practitionerId?: InputMaybe<Scalars['ID']['input']>;
  /** Optional service or appointment-type key from the Book URL. */
  service?: InputMaybe<Scalars['String']['input']>;
  /** Languages the patient needs. At most 10. */
  spokenLanguages?: InputMaybe<Array<Locale>>;
  /** Required start inside a staff availability window. ISO 8601 UTC. */
  startsAt: Scalars['String']['input'];
};

export type UpdateBookingAppointmentStatusInput = {
  appointmentId: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
  /** CONFIRMED, DECLINED, CANCELLED, or COMPLETED. */
  status: BookingAppointmentStatus;
};

export type UpdateBookingSettingsInput = {
  allowedDurations: Array<Scalars['Int']['input']>;
  /** One of allowedDurations. Omit for 30 minutes when offered, else the shortest. */
  defaultDuration?: InputMaybe<Scalars['Int']['input']>;
  facilityId: Scalars['ID']['input'];
  /** Known form ids. The first is the default. */
  formDefinitionIds: Array<Scalars['String']['input']>;
};

/** Input for updating an existing facility. All fields are optional — only provided fields are updated. */
export type UpdateFacilityInput = {
  /** Id of a city in the vocabulary. Null clears the city and marks the row unresolved. */
  cityId?: InputMaybe<Scalars['ID']['input']>;
  /** Updated contact information. */
  contact?: InputMaybe<ContactInput>;
  /** Google place id. Optional, and not a Places payload. */
  googlePlaceId?: InputMaybe<Scalars['String']['input']>;
  /** Healthcare professional relationships to add, update, or remove. */
  healthcareProfessionalIds?: InputMaybe<Array<Relationship>>;
  /** Updated latitude coordinate. Cleared when the facility becomes online. */
  mapLatitude?: InputMaybe<Scalars['Float']['input']>;
  /** Updated longitude coordinate. Cleared when the facility becomes online. */
  mapLongitude?: InputMaybe<Scalars['Float']['input']>;
  /** Updated name of the facility in English. */
  nameEn?: InputMaybe<Scalars['String']['input']>;
  /** Updated name of the facility in Japanese. */
  nameJa?: InputMaybe<Scalars['String']['input']>;
  /**
   * Optional. Set true only for an online facility with no street address.
   * Omit to leave the stored value unchanged.
   */
  online?: InputMaybe<Scalars['Boolean']['input']>;
  /** Payment options for the facility, Type and Brand */
  paymentOptions?: InputMaybe<Array<PaymentOptionsInput>>;
  /** Where this facility record came from. */
  source?: InputMaybe<FacilitySource>;
  /** Replacement published language list. An empty list clears it. Does not create a professional. */
  supportedLanguages?: InputMaybe<Array<Locale>>;
  /** CONFIRMED requires a cityId on the facility. */
  verificationStatus?: InputMaybe<FacilityVerificationStatus>;
};

/** Input for updating an existing healthcare professional. All fields are optional — only provided fields are updated. */
export type UpdateHealthcareProfessionalInput = {
  /** Updated accepted insurance types. */
  acceptedInsurance?: InputMaybe<Array<Insurance>>;
  /** Updated free-text notes or instructions for patients. */
  additionalInfoForPatients?: InputMaybe<Scalars['String']['input']>;
  /** Updated degrees. */
  degrees?: InputMaybe<Array<Degree>>;
  /** Facility relationships to add, update, or remove. */
  facilityIds?: InputMaybe<Array<Relationship>>;
  /** CONFIRMED keeps a dual license. Omit this to classify the degrees you send. */
  licenseReview?: InputMaybe<LicenseReviewStatus>;
  /** Updated localized names. */
  names?: InputMaybe<Array<LocalizedNameInput>>;
  /** Updated specialties. */
  specialties?: InputMaybe<Array<Specialty>>;
  /** Updated spoken languages. */
  spokenLanguages?: InputMaybe<Array<Locale>>;
};

/** Input for updating an existing reservation. */
export type UpdateReservationInput = {
  /** New status for the reservation. */
  status: ReservationStatus;
  /** ID of the user who owns the reservation. */
  userId: Scalars['ID']['input'];
};

/** Input for updating an existing submission. Used during the moderation review process. */
export type UpdateSubmissionInput = {
  /** Facility data to associate with this submission. */
  facility?: InputMaybe<CreateFacilityInput>;
  /** Updated Google Maps URL. */
  googleMapsUrl?: InputMaybe<Scalars['String']['input']>;
  /** Updated healthcare professional name. */
  healthcareProfessionalName?: InputMaybe<Scalars['String']['input']>;
  /** Healthcare professional data to associate with this submission. */
  healthcareProfessionals?: InputMaybe<Array<CreateHealthcareProfessionalInput>>;
  /** Set whether the submission is approved. */
  isApproved?: InputMaybe<Scalars['Boolean']['input']>;
  /** Set whether the submission is rejected. */
  isRejected?: InputMaybe<Scalars['Boolean']['input']>;
  /** Set whether the submission is under review. */
  isUnderReview?: InputMaybe<Scalars['Boolean']['input']>;
  /** Optional notes from the moderator. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Updated spoken languages. */
  spokenLanguages?: InputMaybe<Array<Locale>>;
};

/** Input for updating an existing user. */
export type UpdateUserInput = {
  /** Updated display name. */
  displayName?: InputMaybe<Scalars['String']['input']>;
  /** Updated profile picture URL. */
  profilePicUrl?: InputMaybe<Scalars['String']['input']>;
};

/** A registered user of the Find a Doc platform. */
export type User = {
  __typename?: 'User';
  /** ISO 8601 timestamp of when this user was created. */
  createdDate: Scalars['String']['output'];
  /** Display name shown in the UI. */
  displayName?: Maybe<Scalars['String']['output']>;
  /** Unique identifier for the user. */
  id: Scalars['ID']['output'];
  /** URL of the user's profile picture. */
  profilePicUrl?: Maybe<Scalars['String']['output']>;
  /** ISO 8601 timestamp of the last update to this user. */
  updatedDate: Scalars['String']['output'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  ActionType: ActionType;
  AuditLog: ResolverTypeWrapper<AuditLog>;
  BookingAnswerInput: BookingAnswerInput;
  BookingAnswerView: ResolverTypeWrapper<BookingAnswerView>;
  BookingAppointment: ResolverTypeWrapper<BookingAppointment>;
  BookingAppointmentStatus: BookingAppointmentStatus;
  BookingCancelledBy: BookingCancelledBy;
  BookingClinic: ResolverTypeWrapper<BookingClinic>;
  BookingFieldSensitivity: BookingFieldSensitivity;
  BookingForm: ResolverTypeWrapper<BookingForm>;
  BookingFormField: ResolverTypeWrapper<BookingFormField>;
  BookingFormFieldCondition: ResolverTypeWrapper<BookingFormFieldCondition>;
  BookingFormFieldOption: ResolverTypeWrapper<BookingFormFieldOption>;
  BookingFormFieldType: BookingFormFieldType;
  BookingFormType: ResolverTypeWrapper<BookingFormType>;
  BookingPractitioner: ResolverTypeWrapper<BookingPractitioner>;
  BookingSettings: ResolverTypeWrapper<BookingSettings>;
  BookingSubmissionDetail: ResolverTypeWrapper<BookingSubmissionDetail>;
  BookingSubmissionListItem: ResolverTypeWrapper<BookingSubmissionListItem>;
  BookingSubmissionResult: ResolverTypeWrapper<BookingSubmissionResult>;
  BookingSubmissionSearchFilters: BookingSubmissionSearchFilters;
  BookingSubmissionStatus: BookingSubmissionStatus;
  BookingUploadDisposition: BookingUploadDisposition;
  BookingUploadDownloadUrl: ResolverTypeWrapper<BookingUploadDownloadUrl>;
  BookingUploadHeader: ResolverTypeWrapper<BookingUploadHeader>;
  BookingUploadUrl: ResolverTypeWrapper<BookingUploadUrl>;
  BookingUploadView: ResolverTypeWrapper<BookingUploadView>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CancelBookingByTokenInput: CancelBookingByTokenInput;
  City: ResolverTypeWrapper<City>;
  CitySuggestion: ResolverTypeWrapper<CitySuggestion>;
  ClinicAvailabilityClosure: ResolverTypeWrapper<ClinicAvailabilityClosure>;
  ClinicAvailabilityWindow: ResolverTypeWrapper<ClinicAvailabilityWindow>;
  ClinicMember: ResolverTypeWrapper<ClinicMember>;
  ClinicMemberRole: ClinicMemberRole;
  ClinicMembership: ResolverTypeWrapper<ClinicMembership>;
  ClinicMembershipRole: ClinicMembershipRole;
  ClinicSite: ResolverTypeWrapper<ClinicSite>;
  ClinicSiteCase: ResolverTypeWrapper<ClinicSiteCase>;
  ClinicSiteDoctor: ResolverTypeWrapper<ClinicSiteDoctor>;
  ClinicSiteDoctorCopy: ResolverTypeWrapper<ClinicSiteDoctorCopy>;
  ClinicSiteLanguage: ResolverTypeWrapper<ClinicSiteLanguage>;
  ClinicSiteLocale: ResolverTypeWrapper<ClinicSiteLocale>;
  ClinicSiteNotice: ResolverTypeWrapper<ClinicSiteNotice>;
  ClinicSitePlan: ResolverTypeWrapper<ClinicSitePlan>;
  ClinicSiteStatus: ClinicSiteStatus;
  ClinicSiteStep: ResolverTypeWrapper<ClinicSiteStep>;
  ClinicSiteSummary: ResolverTypeWrapper<ClinicSiteSummary>;
  ClinicSiteTheme: ResolverTypeWrapper<ClinicSiteTheme>;
  ClinicWeeklyHours: ResolverTypeWrapper<ClinicWeeklyHours>;
  ClinicWeeklyHoursInput: ClinicWeeklyHoursInput;
  Contact: ResolverTypeWrapper<Contact>;
  ContactInput: ContactInput;
  CreateBookingUploadUrlInput: CreateBookingUploadUrlInput;
  CreateClinicAvailabilityClosureInput: CreateClinicAvailabilityClosureInput;
  CreateClinicAvailabilityWindowInput: CreateClinicAvailabilityWindowInput;
  CreateFacilityInput: CreateFacilityInput;
  CreateHealthcareProfessionalInput: CreateHealthcareProfessionalInput;
  CreateReservationInput: CreateReservationInput;
  CreateSubmissionInput: CreateSubmissionInput;
  CreateUserInput: CreateUserInput;
  CurrentUserAccess: ResolverTypeWrapper<CurrentUserAccess>;
  Degree: Degree;
  DeleteResult: ResolverTypeWrapper<DeleteResult>;
  Facility: ResolverTypeWrapper<Facility>;
  FacilityPlaceCandidate: ResolverTypeWrapper<FacilityPlaceCandidate>;
  FacilitySearchFilters: FacilitySearchFilters;
  FacilitySource: FacilitySource;
  FacilitySubmission: ResolverTypeWrapper<FacilitySubmission>;
  FacilityVerificationStatus: FacilityVerificationStatus;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  HealthcareProfessional: ResolverTypeWrapper<HealthcareProfessional>;
  HealthcareProfessionalSearchFilters: HealthcareProfessionalSearchFilters;
  HealthcareProfessionalSubmission: ResolverTypeWrapper<HealthcareProfessionalSubmission>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Insurance: Insurance;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  InviteClinicMemberInput: InviteClinicMemberInput;
  LicenseReviewStatus: LicenseReviewStatus;
  Locale: Locale;
  LocalizedName: ResolverTypeWrapper<LocalizedName>;
  LocalizedNameInput: LocalizedNameInput;
  MapsPlacePreview: ResolverTypeWrapper<MapsPlacePreview>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  ObjectType: ObjectType;
  OrderBy: OrderBy;
  OrderDirection: OrderDirection;
  PatientBookingView: ResolverTypeWrapper<PatientBookingView>;
  PaymentOption: ResolverTypeWrapper<PaymentOption>;
  PaymentOptionsInput: PaymentOptionsInput;
  PaymentType: PaymentType;
  PhysicalAddress: ResolverTypeWrapper<PhysicalAddress>;
  PhysicalAddressInput: PhysicalAddressInput;
  PlaceMatchConfidence: PlaceMatchConfidence;
  Prefecture: ResolverTypeWrapper<Prefecture>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Relationship: Relationship;
  RelationshipAction: RelationshipAction;
  Reservation: ResolverTypeWrapper<Reservation>;
  ReservationStatus: ReservationStatus;
  SchemaVersion: SchemaVersion;
  SetClinicWeeklyHoursInput: SetClinicWeeklyHoursInput;
  Specialty: Specialty;
  SpecialtyCategory: SpecialtyCategory;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Submission: ResolverTypeWrapper<Submission>;
  SubmissionSearchFilters: SubmissionSearchFilters;
  SubmitBookingInput: SubmitBookingInput;
  UpdateBookingAppointmentStatusInput: UpdateBookingAppointmentStatusInput;
  UpdateBookingSettingsInput: UpdateBookingSettingsInput;
  UpdateFacilityInput: UpdateFacilityInput;
  UpdateHealthcareProfessionalInput: UpdateHealthcareProfessionalInput;
  UpdateReservationInput: UpdateReservationInput;
  UpdateSubmissionInput: UpdateSubmissionInput;
  UpdateUserInput: UpdateUserInput;
  User: ResolverTypeWrapper<User>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AuditLog: AuditLog;
  BookingAnswerInput: BookingAnswerInput;
  BookingAnswerView: BookingAnswerView;
  BookingAppointment: BookingAppointment;
  BookingClinic: BookingClinic;
  BookingForm: BookingForm;
  BookingFormField: BookingFormField;
  BookingFormFieldCondition: BookingFormFieldCondition;
  BookingFormFieldOption: BookingFormFieldOption;
  BookingFormType: BookingFormType;
  BookingPractitioner: BookingPractitioner;
  BookingSettings: BookingSettings;
  BookingSubmissionDetail: BookingSubmissionDetail;
  BookingSubmissionListItem: BookingSubmissionListItem;
  BookingSubmissionResult: BookingSubmissionResult;
  BookingSubmissionSearchFilters: BookingSubmissionSearchFilters;
  BookingUploadDownloadUrl: BookingUploadDownloadUrl;
  BookingUploadHeader: BookingUploadHeader;
  BookingUploadUrl: BookingUploadUrl;
  BookingUploadView: BookingUploadView;
  Boolean: Scalars['Boolean']['output'];
  CancelBookingByTokenInput: CancelBookingByTokenInput;
  City: City;
  CitySuggestion: CitySuggestion;
  ClinicAvailabilityClosure: ClinicAvailabilityClosure;
  ClinicAvailabilityWindow: ClinicAvailabilityWindow;
  ClinicMember: ClinicMember;
  ClinicMembership: ClinicMembership;
  ClinicSite: ClinicSite;
  ClinicSiteCase: ClinicSiteCase;
  ClinicSiteDoctor: ClinicSiteDoctor;
  ClinicSiteDoctorCopy: ClinicSiteDoctorCopy;
  ClinicSiteLanguage: ClinicSiteLanguage;
  ClinicSiteLocale: ClinicSiteLocale;
  ClinicSiteNotice: ClinicSiteNotice;
  ClinicSitePlan: ClinicSitePlan;
  ClinicSiteStep: ClinicSiteStep;
  ClinicSiteSummary: ClinicSiteSummary;
  ClinicSiteTheme: ClinicSiteTheme;
  ClinicWeeklyHours: ClinicWeeklyHours;
  ClinicWeeklyHoursInput: ClinicWeeklyHoursInput;
  Contact: Contact;
  ContactInput: ContactInput;
  CreateBookingUploadUrlInput: CreateBookingUploadUrlInput;
  CreateClinicAvailabilityClosureInput: CreateClinicAvailabilityClosureInput;
  CreateClinicAvailabilityWindowInput: CreateClinicAvailabilityWindowInput;
  CreateFacilityInput: CreateFacilityInput;
  CreateHealthcareProfessionalInput: CreateHealthcareProfessionalInput;
  CreateReservationInput: CreateReservationInput;
  CreateSubmissionInput: CreateSubmissionInput;
  CreateUserInput: CreateUserInput;
  CurrentUserAccess: CurrentUserAccess;
  DeleteResult: DeleteResult;
  Facility: Facility;
  FacilityPlaceCandidate: FacilityPlaceCandidate;
  FacilitySearchFilters: FacilitySearchFilters;
  FacilitySubmission: FacilitySubmission;
  Float: Scalars['Float']['output'];
  HealthcareProfessional: HealthcareProfessional;
  HealthcareProfessionalSearchFilters: HealthcareProfessionalSearchFilters;
  HealthcareProfessionalSubmission: HealthcareProfessionalSubmission;
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  InviteClinicMemberInput: InviteClinicMemberInput;
  LocalizedName: LocalizedName;
  LocalizedNameInput: LocalizedNameInput;
  MapsPlacePreview: MapsPlacePreview;
  Mutation: Record<PropertyKey, never>;
  OrderBy: OrderBy;
  PatientBookingView: PatientBookingView;
  PaymentOption: PaymentOption;
  PaymentOptionsInput: PaymentOptionsInput;
  PhysicalAddress: PhysicalAddress;
  PhysicalAddressInput: PhysicalAddressInput;
  Prefecture: Prefecture;
  Query: Record<PropertyKey, never>;
  Relationship: Relationship;
  Reservation: Reservation;
  SetClinicWeeklyHoursInput: SetClinicWeeklyHoursInput;
  String: Scalars['String']['output'];
  Submission: Submission;
  SubmissionSearchFilters: SubmissionSearchFilters;
  SubmitBookingInput: SubmitBookingInput;
  UpdateBookingAppointmentStatusInput: UpdateBookingAppointmentStatusInput;
  UpdateBookingSettingsInput: UpdateBookingSettingsInput;
  UpdateFacilityInput: UpdateFacilityInput;
  UpdateHealthcareProfessionalInput: UpdateHealthcareProfessionalInput;
  UpdateReservationInput: UpdateReservationInput;
  UpdateSubmissionInput: UpdateSubmissionInput;
  UpdateUserInput: UpdateUserInput;
  User: User;
};

export type AuditLogResolvers<ContextType = any, ParentType extends ResolversParentTypes['AuditLog'] = ResolversParentTypes['AuditLog']> = {
  actionType?: Resolver<ResolversTypes['ActionType'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  newValue?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  objectType?: Resolver<ResolversTypes['ObjectType'], ParentType, ContextType>;
  oldValue?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  schemaVersion?: Resolver<ResolversTypes['SchemaVersion'], ParentType, ContextType>;
  updatedBy?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type BookingAnswerViewResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingAnswerView'] = ResolversParentTypes['BookingAnswerView']> = {
  fieldId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type BookingAppointmentResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingAppointment'] = ResolversParentTypes['BookingAppointment']> = {
  bookingSubmissionId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  durationMinutes?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  endsAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  facilityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  patientName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  practitionerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  startsAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['BookingAppointmentStatus'], ParentType, ContextType>;
};

export type BookingClinicResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingClinic'] = ResolversParentTypes['BookingClinic']> = {
  canManage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  clinicName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  clinicSiteSlug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  facilityId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  requestedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  role?: Resolver<Maybe<ResolversTypes['ClinicMemberRole']>, ParentType, ContextType>;
};

export type BookingFormResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingForm'] = ResolversParentTypes['BookingForm']> = {
  allowedDurations?: Resolver<Array<ResolversTypes['Int']>, ParentType, ContextType>;
  clinicName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  clinicSiteId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  clinicSiteSlug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  defaultDuration?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  facilityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  fields?: Resolver<Array<ResolversTypes['BookingFormField']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  languages?: Resolver<Array<ResolversTypes['Locale']>, ParentType, ContextType>;
  practitioners?: Resolver<Array<ResolversTypes['BookingPractitioner']>, ParentType, ContextType>;
  themePrimary?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type BookingFormFieldResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingFormField'] = ResolversParentTypes['BookingFormField']> = {
  accept?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hintKey?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  labelKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  max?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  maxBytes?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  maxLength?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  options?: Resolver<Maybe<Array<ResolversTypes['BookingFormFieldOption']>>, ParentType, ContextType>;
  placeholderKey?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  required?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  sensitivity?: Resolver<ResolversTypes['BookingFieldSensitivity'], ParentType, ContextType>;
  showWhen?: Resolver<Maybe<ResolversTypes['BookingFormFieldCondition']>, ParentType, ContextType>;
  stepKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['BookingFormFieldType'], ParentType, ContextType>;
};

export type BookingFormFieldConditionResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingFormFieldCondition'] = ResolversParentTypes['BookingFormFieldCondition']> = {
  equals?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fieldId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type BookingFormFieldOptionResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingFormFieldOption'] = ResolversParentTypes['BookingFormFieldOption']> = {
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  labelKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type BookingFormTypeResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingFormType'] = ResolversParentTypes['BookingFormType']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  labelKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  version?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type BookingPractitionerResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingPractitioner'] = ResolversParentTypes['BookingPractitioner']> = {
  hasOwnSchedule?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  names?: Resolver<Array<ResolversTypes['LocalizedName']>, ParentType, ContextType>;
  specialties?: Resolver<Array<ResolversTypes['Specialty']>, ParentType, ContextType>;
  spokenLanguages?: Resolver<Array<ResolversTypes['Locale']>, ParentType, ContextType>;
};

export type BookingSettingsResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingSettings'] = ResolversParentTypes['BookingSettings']> = {
  allowedDurations?: Resolver<Array<ResolversTypes['Int']>, ParentType, ContextType>;
  defaultDuration?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  facilityId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  formDefinitionIds?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
};

export type BookingSubmissionDetailResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingSubmissionDetail'] = ResolversParentTypes['BookingSubmissionDetail']> = {
  answers?: Resolver<Array<ResolversTypes['BookingAnswerView']>, ParentType, ContextType>;
  appointmentId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  appointmentStatus?: Resolver<Maybe<ResolversTypes['BookingAppointmentStatus']>, ParentType, ContextType>;
  cancelledBy?: Resolver<Maybe<ResolversTypes['BookingCancelledBy']>, ParentType, ContextType>;
  clinicName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  clinicSiteId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  clinicSiteSlug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  endsAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  facilityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  formDefinitionId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  formVersion?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  locale?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  practitionerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  practitionerNames?: Resolver<Array<ResolversTypes['LocalizedName']>, ParentType, ContextType>;
  service?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  spokenLanguages?: Resolver<Array<ResolversTypes['Locale']>, ParentType, ContextType>;
  startsAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['BookingSubmissionStatus'], ParentType, ContextType>;
  statusReason?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  uploads?: Resolver<Array<ResolversTypes['BookingUploadView']>, ParentType, ContextType>;
};

export type BookingSubmissionListItemResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingSubmissionListItem'] = ResolversParentTypes['BookingSubmissionListItem']> = {
  appointmentId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  appointmentStatus?: Resolver<Maybe<ResolversTypes['BookingAppointmentStatus']>, ParentType, ContextType>;
  clinicName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  clinicSiteId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  clinicSiteSlug?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  endsAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  facilityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  formDefinitionId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  formVersion?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  hasIdentityUploads?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  locale?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  patientName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startsAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['BookingSubmissionStatus'], ParentType, ContextType>;
  updatedDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type BookingSubmissionResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingSubmissionResult'] = ResolversParentTypes['BookingSubmissionResult']> = {
  appointmentId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  clinicSiteId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  facilityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  manageToken?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['BookingSubmissionStatus'], ParentType, ContextType>;
};

export type BookingUploadDownloadUrlResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingUploadDownloadUrl'] = ResolversParentTypes['BookingUploadDownloadUrl']> = {
  downloadUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  expiresAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  uploadId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type BookingUploadHeaderResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingUploadHeader'] = ResolversParentTypes['BookingUploadHeader']> = {
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type BookingUploadUrlResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingUploadUrl'] = ResolversParentTypes['BookingUploadUrl']> = {
  expiresAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  headers?: Resolver<Array<ResolversTypes['BookingUploadHeader']>, ParentType, ContextType>;
  objectKey?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  uploadId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  uploadUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type BookingUploadViewResolvers<ContextType = any, ParentType extends ResolversParentTypes['BookingUploadView'] = ResolversParentTypes['BookingUploadView']> = {
  byteSize?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  contentType?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fieldId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fileName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  purgedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  retainUntil?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  sensitivity?: Resolver<ResolversTypes['BookingFieldSensitivity'], ParentType, ContextType>;
};

export type CityResolvers<ContextType = any, ParentType extends ResolversParentTypes['City'] = ResolversParentTypes['City']> = {
  googlePlaceId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  localGovernmentCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nameEn?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nameJa?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  prefecture?: Resolver<ResolversTypes['Prefecture'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type CitySuggestionResolvers<ContextType = any, ParentType extends ResolversParentTypes['CitySuggestion'] = ResolversParentTypes['CitySuggestion']> = {
  city?: Resolver<Maybe<ResolversTypes['City']>, ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  placeId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicAvailabilityClosureResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicAvailabilityClosure'] = ResolversParentTypes['ClinicAvailabilityClosure']> = {
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  endsAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  facilityId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  practitionerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  reason?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startsAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicAvailabilityWindowResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicAvailabilityWindow'] = ResolversParentTypes['ClinicAvailabilityWindow']> = {
  clinicSiteId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  endsAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  facilityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  practitionerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  startsAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicMemberResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicMember'] = ResolversParentTypes['ClinicMember']> = {
  claimed?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  facilityId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['ClinicMemberRole'], ParentType, ContextType>;
};

export type ClinicMembershipResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicMembership'] = ResolversParentTypes['ClinicMembership']> = {
  clinicSiteId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['ClinicMembershipRole'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type ClinicSiteResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSite'] = ResolversParentTypes['ClinicSite']> = {
  doctors?: Resolver<Array<ResolversTypes['ClinicSiteDoctor']>, ParentType, ContextType>;
  facilityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  heroPath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  languages?: Resolver<Array<ResolversTypes['ClinicSiteLanguage']>, ParentType, ContextType>;
  locales?: Resolver<Array<ResolversTypes['ClinicSiteLocale']>, ParentType, ContextType>;
  shareImagePath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ClinicSiteStatus'], ParentType, ContextType>;
  theme?: Resolver<ResolversTypes['ClinicSiteTheme'], ParentType, ContextType>;
};

export type ClinicSiteCaseResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteCase'] = ResolversParentTypes['ClinicSiteCase']> = {
  detail?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicSiteDoctorResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteDoctor'] = ResolversParentTypes['ClinicSiteDoctor']> = {
  hpId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  imagePath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nameEn?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nameJa?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  objectPosition?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicSiteDoctorCopyResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteDoctorCopy'] = ResolversParentTypes['ClinicSiteDoctorCopy']> = {
  alt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  paragraphs?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  tag?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicSiteLanguageResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteLanguage'] = ResolversParentTypes['ClinicSiteLanguage']> = {
  bcp47?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  code?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  native?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicSiteLocaleResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteLocale'] = ResolversParentTypes['ClinicSiteLocale']> = {
  about?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  aboutEyebrow?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  aboutTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  badgeDetail?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  badgeTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  book?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  bookEyebrow?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  bookLead?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  bookNote?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  bookTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  cases?: Resolver<Array<ResolversTypes['ClinicSiteCase']>, ParentType, ContextType>;
  casesEyebrow?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  casesLead?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  casesTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ctaButton?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ctaLead?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ctaTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  doctorCopy?: Resolver<Array<ResolversTypes['ClinicSiteDoctorCopy']>, ParentType, ContextType>;
  doctorsEyebrow?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  doctorsTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  emergency?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fees?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  feesEyebrow?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  feesLead?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  feesLink?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  feesTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  flowEyebrow?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  flowTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  heroAlt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  heroBadge?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  heroLead?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  heroNote?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  heroTitleBefore?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  heroTitleHighlight?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  highlights?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  includedLabel?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  locale?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  navCases?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  navDoctors?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  navFees?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  navFlow?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  noticeEyebrow?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  noticeLead?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  noticeTitle?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  notices?: Resolver<Array<ResolversTypes['ClinicSiteNotice']>, ParentType, ContextType>;
  plans?: Resolver<Array<ResolversTypes['ClinicSitePlan']>, ParentType, ContextType>;
  rangeLabel?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  referralNote?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sectionNavLabel?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  seeFees?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  steps?: Resolver<Array<ResolversTypes['ClinicSiteStep']>, ParentType, ContextType>;
};

export type ClinicSiteNoticeResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteNotice'] = ResolversParentTypes['ClinicSiteNotice']> = {
  detail?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  feesLink?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicSitePlanResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSitePlan'] = ResolversParentTypes['ClinicSitePlan']> = {
  amount?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  note?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicSiteStepResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteStep'] = ResolversParentTypes['ClinicSiteStep']> = {
  detail?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ClinicSiteSummaryResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteSummary'] = ResolversParentTypes['ClinicSiteSummary']> = {
  facilityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  localeCodes?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  shareImagePath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ClinicSiteStatus'], ParentType, ContextType>;
};

export type ClinicSiteThemeResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicSiteTheme'] = ResolversParentTypes['ClinicSiteTheme']> = {
  primary?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type ClinicWeeklyHoursResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClinicWeeklyHours'] = ResolversParentTypes['ClinicWeeklyHours']> = {
  endMinute?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  facilityId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  practitionerId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  startMinute?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  weekday?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type ContactResolvers<ContextType = any, ParentType extends ResolversParentTypes['Contact'] = ResolversParentTypes['Contact']> = {
  address?: Resolver<Maybe<ResolversTypes['PhysicalAddress']>, ParentType, ContextType>;
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  googleMapsUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  phone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  website?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type CurrentUserAccessResolvers<ContextType = any, ParentType extends ResolversParentTypes['CurrentUserAccess'] = ResolversParentTypes['CurrentUserAccess']> = {
  effectiveScopes?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  jwtScopes?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  roles?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
};

export type DeleteResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['DeleteResult'] = ResolversParentTypes['DeleteResult']> = {
  isSuccessful?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type FacilityResolvers<ContextType = any, ParentType extends ResolversParentTypes['Facility'] = ResolversParentTypes['Facility']> = {
  bookingEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  city?: Resolver<Maybe<ResolversTypes['City']>, ParentType, ContextType>;
  cityId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  contact?: Resolver<ResolversTypes['Contact'], ParentType, ContextType>;
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  googlePlaceId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  healthcareProfessionalIds?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  mapLatitude?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  mapLongitude?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  nameEn?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nameJa?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  online?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  paymentOptions?: Resolver<Maybe<Array<ResolversTypes['PaymentOption']>>, ParentType, ContextType>;
  source?: Resolver<Maybe<ResolversTypes['FacilitySource']>, ParentType, ContextType>;
  supportedLanguages?: Resolver<Array<ResolversTypes['Locale']>, ParentType, ContextType>;
  updatedDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  verificationStatus?: Resolver<ResolversTypes['FacilityVerificationStatus'], ParentType, ContextType>;
};

export type FacilityPlaceCandidateResolvers<ContextType = any, ParentType extends ResolversParentTypes['FacilityPlaceCandidate'] = ResolversParentTypes['FacilityPlaceCandidate']> = {
  address?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  confidence?: Resolver<ResolversTypes['PlaceMatchConfidence'], ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  placeId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type FacilitySubmissionResolvers<ContextType = any, ParentType extends ResolversParentTypes['FacilitySubmission'] = ResolversParentTypes['FacilitySubmission']> = {
  contact?: Resolver<Maybe<ResolversTypes['Contact']>, ParentType, ContextType>;
  healthcareProfessionalIds?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  mapLatitude?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  mapLongitude?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  nameEn?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  nameJa?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  online?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
};

export type HealthcareProfessionalResolvers<ContextType = any, ParentType extends ResolversParentTypes['HealthcareProfessional'] = ResolversParentTypes['HealthcareProfessional']> = {
  acceptedInsurance?: Resolver<Array<ResolversTypes['Insurance']>, ParentType, ContextType>;
  additionalCredentials?: Resolver<Array<ResolversTypes['Degree']>, ParentType, ContextType>;
  additionalInfoForPatients?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  degrees?: Resolver<Array<ResolversTypes['Degree']>, ParentType, ContextType>;
  facilityIds?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  licenseRecommendation?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  licenseReview?: Resolver<Maybe<ResolversTypes['LicenseReviewStatus']>, ParentType, ContextType>;
  names?: Resolver<Array<ResolversTypes['LocalizedName']>, ParentType, ContextType>;
  primaryLicense?: Resolver<Maybe<ResolversTypes['Degree']>, ParentType, ContextType>;
  specialties?: Resolver<Array<ResolversTypes['Specialty']>, ParentType, ContextType>;
  spokenLanguages?: Resolver<Array<ResolversTypes['Locale']>, ParentType, ContextType>;
  updatedDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type HealthcareProfessionalSubmissionResolvers<ContextType = any, ParentType extends ResolversParentTypes['HealthcareProfessionalSubmission'] = ResolversParentTypes['HealthcareProfessionalSubmission']> = {
  acceptedInsurance?: Resolver<Maybe<Array<ResolversTypes['Insurance']>>, ParentType, ContextType>;
  additionalInfoForPatients?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  degrees?: Resolver<Maybe<Array<ResolversTypes['Degree']>>, ParentType, ContextType>;
  facilityIds?: Resolver<Array<ResolversTypes['ID']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  names?: Resolver<Array<ResolversTypes['LocalizedName']>, ParentType, ContextType>;
  specialties?: Resolver<Maybe<Array<ResolversTypes['Specialty']>>, ParentType, ContextType>;
  spokenLanguages?: Resolver<Array<ResolversTypes['Locale']>, ParentType, ContextType>;
};

export type LocalizedNameResolvers<ContextType = any, ParentType extends ResolversParentTypes['LocalizedName'] = ResolversParentTypes['LocalizedName']> = {
  firstName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  lastName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  locale?: Resolver<ResolversTypes['Locale'], ParentType, ContextType>;
  middleName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type MapsPlacePreviewResolvers<ContextType = any, ParentType extends ResolversParentTypes['MapsPlacePreview'] = ResolversParentTypes['MapsPlacePreview']> = {
  address?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  category?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  placeId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  bookingUploadDownloadUrl?: Resolver<ResolversTypes['BookingUploadDownloadUrl'], ParentType, ContextType, RequireFields<MutationBookingUploadDownloadUrlArgs, 'uploadId'>>;
  cancelBookingByToken?: Resolver<ResolversTypes['PatientBookingView'], ParentType, ContextType, RequireFields<MutationCancelBookingByTokenArgs, 'input'>>;
  confirmFacilityPlaceId?: Resolver<ResolversTypes['Facility'], ParentType, ContextType, RequireFields<MutationConfirmFacilityPlaceIdArgs, 'facilityId' | 'placeId'>>;
  createBookingUploadUrl?: Resolver<ResolversTypes['BookingUploadUrl'], ParentType, ContextType, RequireFields<MutationCreateBookingUploadUrlArgs, 'input'>>;
  createClinicAvailabilityClosure?: Resolver<ResolversTypes['ClinicAvailabilityClosure'], ParentType, ContextType, RequireFields<MutationCreateClinicAvailabilityClosureArgs, 'input'>>;
  createClinicAvailabilityWindow?: Resolver<ResolversTypes['ClinicAvailabilityWindow'], ParentType, ContextType, RequireFields<MutationCreateClinicAvailabilityWindowArgs, 'input'>>;
  createFacility?: Resolver<ResolversTypes['Facility'], ParentType, ContextType, RequireFields<MutationCreateFacilityArgs, 'input'>>;
  createHealthcareProfessional?: Resolver<ResolversTypes['HealthcareProfessional'], ParentType, ContextType, RequireFields<MutationCreateHealthcareProfessionalArgs, 'input'>>;
  createReservation?: Resolver<ResolversTypes['Reservation'], ParentType, ContextType, RequireFields<MutationCreateReservationArgs, 'input'>>;
  createSubmission?: Resolver<ResolversTypes['Submission'], ParentType, ContextType, RequireFields<MutationCreateSubmissionArgs, 'input'>>;
  createUser?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  deleteClinicAvailabilityClosure?: Resolver<ResolversTypes['DeleteResult'], ParentType, ContextType, RequireFields<MutationDeleteClinicAvailabilityClosureArgs, 'id'>>;
  deleteClinicAvailabilityWindow?: Resolver<ResolversTypes['DeleteResult'], ParentType, ContextType, RequireFields<MutationDeleteClinicAvailabilityWindowArgs, 'id'>>;
  deleteFacility?: Resolver<ResolversTypes['DeleteResult'], ParentType, ContextType, RequireFields<MutationDeleteFacilityArgs, 'id'>>;
  deleteHealthcareProfessional?: Resolver<ResolversTypes['DeleteResult'], ParentType, ContextType, RequireFields<MutationDeleteHealthcareProfessionalArgs, 'id'>>;
  deleteSubmission?: Resolver<ResolversTypes['DeleteResult'], ParentType, ContextType, RequireFields<MutationDeleteSubmissionArgs, 'id'>>;
  inviteClinicMember?: Resolver<ResolversTypes['ClinicMember'], ParentType, ContextType, RequireFields<MutationInviteClinicMemberArgs, 'input'>>;
  recordCityPlaceId?: Resolver<ResolversTypes['City'], ParentType, ContextType, RequireFields<MutationRecordCityPlaceIdArgs, 'cityId' | 'placeId'>>;
  removeClinicMember?: Resolver<ResolversTypes['DeleteResult'], ParentType, ContextType, RequireFields<MutationRemoveClinicMemberArgs, 'id'>>;
  setClinicWeeklyHours?: Resolver<Array<ResolversTypes['ClinicWeeklyHours']>, ParentType, ContextType, RequireFields<MutationSetClinicWeeklyHoursArgs, 'input'>>;
  submitBooking?: Resolver<ResolversTypes['BookingSubmissionResult'], ParentType, ContextType, RequireFields<MutationSubmitBookingArgs, 'input'>>;
  updateBookingAppointmentStatus?: Resolver<ResolversTypes['BookingAppointment'], ParentType, ContextType, RequireFields<MutationUpdateBookingAppointmentStatusArgs, 'input'>>;
  updateBookingSettings?: Resolver<ResolversTypes['BookingSettings'], ParentType, ContextType, RequireFields<MutationUpdateBookingSettingsArgs, 'input'>>;
  updateFacility?: Resolver<ResolversTypes['Facility'], ParentType, ContextType, RequireFields<MutationUpdateFacilityArgs, 'id' | 'input'>>;
  updateHealthcareProfessional?: Resolver<ResolversTypes['HealthcareProfessional'], ParentType, ContextType, RequireFields<MutationUpdateHealthcareProfessionalArgs, 'id' | 'input'>>;
  updateReservation?: Resolver<ResolversTypes['Reservation'], ParentType, ContextType, RequireFields<MutationUpdateReservationArgs, 'input'>>;
  updateSubmission?: Resolver<ResolversTypes['Submission'], ParentType, ContextType, RequireFields<MutationUpdateSubmissionArgs, 'id' | 'input'>>;
  updateUser?: Resolver<ResolversTypes['User'], ParentType, ContextType, RequireFields<MutationUpdateUserArgs, 'id' | 'input'>>;
};

export type PatientBookingViewResolvers<ContextType = any, ParentType extends ResolversParentTypes['PatientBookingView'] = ResolversParentTypes['PatientBookingView']> = {
  canCancel?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  clinicName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  endsAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  startsAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['BookingAppointmentStatus']>, ParentType, ContextType>;
};

export type PaymentOptionResolvers<ContextType = any, ParentType extends ResolversParentTypes['PaymentOption'] = ResolversParentTypes['PaymentOption']> = {
  paymentBrands?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  paymentType?: Resolver<ResolversTypes['PaymentType'], ParentType, ContextType>;
};

export type PhysicalAddressResolvers<ContextType = any, ParentType extends ResolversParentTypes['PhysicalAddress'] = ResolversParentTypes['PhysicalAddress']> = {
  addressLine1En?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  addressLine1Ja?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  addressLine2En?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  addressLine2Ja?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  cityEn?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  cityJa?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  postalCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  prefectureEn?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  prefectureJa?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type PrefectureResolvers<ContextType = any, ParentType extends ResolversParentTypes['Prefecture'] = ResolversParentTypes['Prefecture']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  nameEn?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nameJa?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  slug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  auditLog?: Resolver<Maybe<ResolversTypes['AuditLog']>, ParentType, ContextType, Partial<QueryAuditLogArgs>>;
  availableBookingStarts?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType, RequireFields<QueryAvailableBookingStartsArgs, 'clinicSiteId' | 'from' | 'to'>>;
  bookingAvailable?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  bookingClinic?: Resolver<Maybe<ResolversTypes['BookingClinic']>, ParentType, ContextType, RequireFields<QueryBookingClinicArgs, 'facilityId'>>;
  bookingClinics?: Resolver<Array<ResolversTypes['BookingClinic']>, ParentType, ContextType>;
  bookingForm?: Resolver<Maybe<ResolversTypes['BookingForm']>, ParentType, ContextType, RequireFields<QueryBookingFormArgs, 'clinicSiteId'>>;
  bookingFormTypes?: Resolver<Array<ResolversTypes['BookingFormType']>, ParentType, ContextType>;
  bookingSettings?: Resolver<Maybe<ResolversTypes['BookingSettings']>, ParentType, ContextType, RequireFields<QueryBookingSettingsArgs, 'facilityId'>>;
  bookingSubmission?: Resolver<Maybe<ResolversTypes['BookingSubmissionDetail']>, ParentType, ContextType, RequireFields<QueryBookingSubmissionArgs, 'id'>>;
  bookingSubmissions?: Resolver<Array<ResolversTypes['BookingSubmissionListItem']>, ParentType, ContextType, RequireFields<QueryBookingSubmissionsArgs, 'filters'>>;
  bookingSubmissionsTotalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType, RequireFields<QueryBookingSubmissionsTotalCountArgs, 'filters'>>;
  cities?: Resolver<Array<ResolversTypes['City']>, ParentType, ContextType, Partial<QueryCitiesArgs>>;
  cityFacilities?: Resolver<Array<ResolversTypes['Facility']>, ParentType, ContextType, RequireFields<QueryCityFacilitiesArgs, 'citySlug' | 'prefecture'>>;
  clinicAppointments?: Resolver<Array<ResolversTypes['BookingAppointment']>, ParentType, ContextType, RequireFields<QueryClinicAppointmentsArgs, 'clinicId' | 'from' | 'to'>>;
  clinicAvailabilityClosures?: Resolver<Array<ResolversTypes['ClinicAvailabilityClosure']>, ParentType, ContextType, RequireFields<QueryClinicAvailabilityClosuresArgs, 'clinicId' | 'from' | 'to'>>;
  clinicAvailabilityWindows?: Resolver<Array<ResolversTypes['ClinicAvailabilityWindow']>, ParentType, ContextType, RequireFields<QueryClinicAvailabilityWindowsArgs, 'clinicSiteId' | 'from' | 'to'>>;
  clinicMembers?: Resolver<Array<ResolversTypes['ClinicMember']>, ParentType, ContextType, RequireFields<QueryClinicMembersArgs, 'facilityId'>>;
  clinicPractitioners?: Resolver<Array<ResolversTypes['BookingPractitioner']>, ParentType, ContextType, RequireFields<QueryClinicPractitionersArgs, 'clinicId'>>;
  clinicSite?: Resolver<Maybe<ResolversTypes['ClinicSite']>, ParentType, ContextType, RequireFields<QueryClinicSiteArgs, 'slug'>>;
  clinicSites?: Resolver<Array<ResolversTypes['ClinicSiteSummary']>, ParentType, ContextType>;
  clinicWeeklyHours?: Resolver<Array<ResolversTypes['ClinicWeeklyHours']>, ParentType, ContextType, RequireFields<QueryClinicWeeklyHoursArgs, 'clinicId'>>;
  currentUserAccess?: Resolver<ResolversTypes['CurrentUserAccess'], ParentType, ContextType>;
  facilities?: Resolver<Array<ResolversTypes['Facility']>, ParentType, ContextType, RequireFields<QueryFacilitiesArgs, 'filters'>>;
  facilitiesTotalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType, RequireFields<QueryFacilitiesTotalCountArgs, 'filters'>>;
  facility?: Resolver<Maybe<ResolversTypes['Facility']>, ParentType, ContextType, RequireFields<QueryFacilityArgs, 'id'>>;
  facilityByGooglePlaceId?: Resolver<Maybe<ResolversTypes['Facility']>, ParentType, ContextType, RequireFields<QueryFacilityByGooglePlaceIdArgs, 'placeId'>>;
  facilityMatchingMapsUrl?: Resolver<Maybe<ResolversTypes['Facility']>, ParentType, ContextType, RequireFields<QueryFacilityMatchingMapsUrlArgs, 'url'>>;
  healthcareProfessional?: Resolver<Maybe<ResolversTypes['HealthcareProfessional']>, ParentType, ContextType, RequireFields<QueryHealthcareProfessionalArgs, 'id'>>;
  healthcareProfessionals?: Resolver<Array<ResolversTypes['HealthcareProfessional']>, ParentType, ContextType, RequireFields<QueryHealthcareProfessionalsArgs, 'filters'>>;
  healthcareProfessionalsTotalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType, RequireFields<QueryHealthcareProfessionalsTotalCountArgs, 'filters'>>;
  mapsPlacePreview?: Resolver<Maybe<ResolversTypes['MapsPlacePreview']>, ParentType, ContextType, RequireFields<QueryMapsPlacePreviewArgs, 'url'>>;
  myBookingClinics?: Resolver<Array<ResolversTypes['BookingClinic']>, ParentType, ContextType>;
  patientBooking?: Resolver<Maybe<ResolversTypes['PatientBookingView']>, ParentType, ContextType, RequireFields<QueryPatientBookingArgs, 'token'>>;
  prefectures?: Resolver<Array<ResolversTypes['Prefecture']>, ParentType, ContextType>;
  publishedLanguages?: Resolver<Array<ResolversTypes['Locale']>, ParentType, ContextType>;
  reservation?: Resolver<Maybe<ResolversTypes['Reservation']>, ParentType, ContextType, RequireFields<QueryReservationArgs, 'id'>>;
  submission?: Resolver<Maybe<ResolversTypes['Submission']>, ParentType, ContextType, RequireFields<QuerySubmissionArgs, 'id'>>;
  submissions?: Resolver<Array<ResolversTypes['Submission']>, ParentType, ContextType, RequireFields<QuerySubmissionsArgs, 'filters'>>;
  submissionsTotalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType, RequireFields<QuerySubmissionsTotalCountArgs, 'filters'>>;
  suggestCities?: Resolver<Array<ResolversTypes['CitySuggestion']>, ParentType, ContextType, RequireFields<QuerySuggestCitiesArgs, 'input'>>;
  suggestFacilityPlaces?: Resolver<Array<ResolversTypes['FacilityPlaceCandidate']>, ParentType, ContextType, Partial<QuerySuggestFacilityPlacesArgs>>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType, RequireFields<QueryUserArgs, 'id'>>;
};

export type ReservationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Reservation'] = ResolversParentTypes['Reservation']> = {
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['ReservationStatus'], ParentType, ContextType>;
  updatedDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
};

export type SubmissionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Submission'] = ResolversParentTypes['Submission']> = {
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  facility?: Resolver<Maybe<ResolversTypes['FacilitySubmission']>, ParentType, ContextType>;
  googleMapsUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  healthcareProfessionalName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  healthcareProfessionals?: Resolver<Maybe<Array<ResolversTypes['HealthcareProfessionalSubmission']>>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isApproved?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isRejected?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isUnderReview?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  notes?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  spokenLanguages?: Resolver<Array<ResolversTypes['Locale']>, ParentType, ContextType>;
  updatedDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  createdDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  displayName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  profilePicUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  AuditLog?: AuditLogResolvers<ContextType>;
  BookingAnswerView?: BookingAnswerViewResolvers<ContextType>;
  BookingAppointment?: BookingAppointmentResolvers<ContextType>;
  BookingClinic?: BookingClinicResolvers<ContextType>;
  BookingForm?: BookingFormResolvers<ContextType>;
  BookingFormField?: BookingFormFieldResolvers<ContextType>;
  BookingFormFieldCondition?: BookingFormFieldConditionResolvers<ContextType>;
  BookingFormFieldOption?: BookingFormFieldOptionResolvers<ContextType>;
  BookingFormType?: BookingFormTypeResolvers<ContextType>;
  BookingPractitioner?: BookingPractitionerResolvers<ContextType>;
  BookingSettings?: BookingSettingsResolvers<ContextType>;
  BookingSubmissionDetail?: BookingSubmissionDetailResolvers<ContextType>;
  BookingSubmissionListItem?: BookingSubmissionListItemResolvers<ContextType>;
  BookingSubmissionResult?: BookingSubmissionResultResolvers<ContextType>;
  BookingUploadDownloadUrl?: BookingUploadDownloadUrlResolvers<ContextType>;
  BookingUploadHeader?: BookingUploadHeaderResolvers<ContextType>;
  BookingUploadUrl?: BookingUploadUrlResolvers<ContextType>;
  BookingUploadView?: BookingUploadViewResolvers<ContextType>;
  City?: CityResolvers<ContextType>;
  CitySuggestion?: CitySuggestionResolvers<ContextType>;
  ClinicAvailabilityClosure?: ClinicAvailabilityClosureResolvers<ContextType>;
  ClinicAvailabilityWindow?: ClinicAvailabilityWindowResolvers<ContextType>;
  ClinicMember?: ClinicMemberResolvers<ContextType>;
  ClinicMembership?: ClinicMembershipResolvers<ContextType>;
  ClinicSite?: ClinicSiteResolvers<ContextType>;
  ClinicSiteCase?: ClinicSiteCaseResolvers<ContextType>;
  ClinicSiteDoctor?: ClinicSiteDoctorResolvers<ContextType>;
  ClinicSiteDoctorCopy?: ClinicSiteDoctorCopyResolvers<ContextType>;
  ClinicSiteLanguage?: ClinicSiteLanguageResolvers<ContextType>;
  ClinicSiteLocale?: ClinicSiteLocaleResolvers<ContextType>;
  ClinicSiteNotice?: ClinicSiteNoticeResolvers<ContextType>;
  ClinicSitePlan?: ClinicSitePlanResolvers<ContextType>;
  ClinicSiteStep?: ClinicSiteStepResolvers<ContextType>;
  ClinicSiteSummary?: ClinicSiteSummaryResolvers<ContextType>;
  ClinicSiteTheme?: ClinicSiteThemeResolvers<ContextType>;
  ClinicWeeklyHours?: ClinicWeeklyHoursResolvers<ContextType>;
  Contact?: ContactResolvers<ContextType>;
  CurrentUserAccess?: CurrentUserAccessResolvers<ContextType>;
  DeleteResult?: DeleteResultResolvers<ContextType>;
  Facility?: FacilityResolvers<ContextType>;
  FacilityPlaceCandidate?: FacilityPlaceCandidateResolvers<ContextType>;
  FacilitySubmission?: FacilitySubmissionResolvers<ContextType>;
  HealthcareProfessional?: HealthcareProfessionalResolvers<ContextType>;
  HealthcareProfessionalSubmission?: HealthcareProfessionalSubmissionResolvers<ContextType>;
  LocalizedName?: LocalizedNameResolvers<ContextType>;
  MapsPlacePreview?: MapsPlacePreviewResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PatientBookingView?: PatientBookingViewResolvers<ContextType>;
  PaymentOption?: PaymentOptionResolvers<ContextType>;
  PhysicalAddress?: PhysicalAddressResolvers<ContextType>;
  Prefecture?: PrefectureResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Reservation?: ReservationResolvers<ContextType>;
  Submission?: SubmissionResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
};

