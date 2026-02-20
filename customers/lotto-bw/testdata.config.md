# Test Data Configuration: Lotto Baden-Württemberg

## Overview

This configuration defines the test data records to be created in a Lotto-BW Salesforce org. Records are organized by dependency order — parent records are created first.

## Record Groups

---

### 0. Internal Company Account

#### 0a. Lotto BW Company Account (Staatliche Toto-Lotto GmbH)

This is the internal Lotto BW company account — a prerequisite for B2B processes. Unlike test records, this uses a fixed name (no `{{Today}}` suffix) because it represents the real company entity. The skill should **skip creation if an account with this exact name already exists**.

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_BusinessAccount` |
| Name | `Staatliche Toto-Lotto GmbH Baden-Württemberg` |
| BillingState | `Baden-Württemberg` |
| referenceId | `lottoBWCompanyAccount` |

---

### 0b. Test Users (Lookup existing)

These are NOT created — the skill queries existing active users by their role name and stores the Id as a reference. If no user with the specified role is found, the skill logs a warning and skips the OwnerId assignment (fallback: running user remains owner).

#### 0b-i. User: Regionaldirektion 1

| Field | Value |
|-------|-------|
| sObject | `User` |
| operation | `lookup` |
| lookupQuery | `SELECT Id FROM User WHERE UserRole.Name LIKE 'RD%' AND IsActive = true ORDER BY UserRole.Name ASC LIMIT 1` |
| referenceId | `userRD1` |

#### 0b-ii. User: Regionaldirektion 2

| Field | Value |
|-------|-------|
| sObject | `User` |
| operation | `lookup` |
| lookupQuery | `SELECT Id FROM User WHERE UserRole.Name LIKE 'RD%' AND IsActive = true ORDER BY UserRole.Name ASC LIMIT 1 OFFSET 1` |
| referenceId | `userRD2` |

> **Note:** Queries two distinct active users whose role starts with "RD" (e.g., "RD Stuttgart" and "RD Karlsruhe"). Uses ORDER BY + OFFSET to get deterministic, different results. If only one RD user exists, `userRD2` falls back to the running user. Adjust the LIKE filter per org if needed.

---

### 1. B2C Person Accounts

#### 1a. B2C Prospect Account (Interessent)

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLG_StandardPersonAccount` |
| Salutation | `Herr` |
| FirstName | `Test` |
| MiddleName | `Maria` |
| LastName | `Interessent-{{Today}}` |
| PersonEmail | `test.interessent@example.com` |
| Phone | `0711-1234567` |
| BillingStreet | `Nordbahnhofstraße 135` |
| BillingPostalCode | `70191` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| referenceId | `b2cProspect` |

#### 1b. B2C Customer Account (Bestandskunde)

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLG_StandardPersonAccount` |
| Salutation | `Frau` |
| FirstName | `Test` |
| MiddleName | `Elisabeth` |
| LastName | `Bestandskunde-{{Today}}` |
| PersonEmail | `test.bestandskunde@example.com` |
| Phone | `0711-9876543` |
| BillingStreet | `Königstraße 20` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLG_CustomerNumber__c | `TEST-{{Year}}-001` |
| referenceId | `b2cCustomer` |

---

### 2. B2B Accounts

#### 2a. B2B Business Account (Geschäftskunde — juristische Person)

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_BusinessAccount` |
| Name | `Test Geschäftskunde {{Today}}` |
| Phone | `0711-5551234` |
| BillingStreet | `Schillerstraße 10` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| OwnerId | `{{Ref:userRD1}}` |
| referenceId | `b2bBusinessAccount` |

#### 2b. B2B Potential Store (Potenzielle Annahmestelle — ohne Business Account)

> `STLGS_RegionalDirectorate__c` is a formula field (auto-computed) — do not set manually.

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_PotentialStore` |
| Name | `Test Pot. ASt {{Today}}` |
| Phone | `0711-5559876` |
| BillingStreet | `Marktplatz 5` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_StoreStatus__c | `Potentielle Ast` |
| OwnerId | `{{Ref:userRD1}}` |
| referenceId | `b2bPotentialStore` |

#### 2c. B2B Store — Vollannahmestelle (natürliche Person — kein Business Account)

Natürliche Person: Lizenzinhaber betreibt die ASt selbst. Kein Business Account, kein GBV, kein ParentId.

> `STLGS_RegionalDirectorate__c` and `STLGS_SalesType__c` are formula fields on Account — do not set manually.

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_Store` |
| Name | `Test ASt VollASt {{Today}}` |
| Phone | `0711-5554321` |
| BillingStreet | `Hauptstraße 42` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_StoreStatus__c | `Betriebsbereit` |
| STLGS_StoreContractType__c | `natural person` |
| OwnerId | `{{Ref:userRD1}}` |
| referenceId | `b2bStoreVollASt` |

#### 2d. B2B Store — Lotto Kompakt (juristische Person — mit Business Account)

Juristische Person: GmbH als Vertragspartner (Business Account = Parent), Filialverantwortliche pro Standort, Geschäftsbesorgungsvertrag (GBV).

> `STLGS_RegionalDirectorate__c` and `STLGS_SalesType__c` are formula fields on Account — do not set manually.

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_Store` |
| Name | `Test ASt LK {{Today}}` |
| Phone | `0711-5556789` |
| BillingStreet | `Bahnhofstraße 15` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_StoreStatus__c | `Betriebsbereit` |
| STLGS_StoreContractType__c | `legal person` |
| ParentId | `{{Ref:b2bBusinessAccount}}` |
| OwnerId | `{{Ref:userRD2}}` |
| referenceId | `b2bStoreLK` |

---

### 3. Contacts

#### 3a. Geschäftsführer (Business Account)

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| FirstName | `Max` |
| MiddleName | `Johann` |
| LastName | `Testgeschäftsführer-{{Today}}` |
| Email | `max.testgf@example.com` |
| Phone | `0711-5551111` |
| AccountId | `{{Ref:b2bBusinessAccount}}` |
| referenceId | `contactGF` |

#### 3b. Lizenzinhaber / ASt-Leiter (Store Vollannahmestelle — deutsch)

Antragsteller natürliche Person: braucht Privatanschrift (Other-Felder), Geburtsdaten und Staatsangehörigkeit.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| FirstName | `Anna` |
| MiddleName | `Sophie` |
| LastName | `Testinhaber-{{Today}}` |
| Email | `anna.testinhaber@example.com` |
| Phone | `0711-5552222` |
| OtherStreet | `Rosensteinstraße 8` |
| OtherPostalCode | `70191` |
| OtherCity | `Stuttgart` |
| OtherCountry | `Germany` |
| Birthdate | `1985-06-15` |
| STLGS_Birthplace__c | `Stuttgart` |
| STLGS_Nationality__c | `54` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| referenceId | `contactLizenzinhaber` |

#### 3c. Filialverantwortliche (Store Lotto Kompakt)

Filialverantwortliche bei jur. Person: KEINE Privatanschrift nötig (Antragsteller ist der Business Account).

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| FirstName | `Lisa` |
| MiddleName | `Marie` |
| LastName | `Testfiliale-{{Today}}` |
| Email | `lisa.testfiliale@example.com` |
| Phone | `0711-5553333` |
| AccountId | `{{Ref:b2bStoreLK}}` |
| referenceId | `contactFilialverantwortliche` |

#### 3d. Lizenzinhaber — EU-Ausländer (Frankreich)

Antragsteller natürliche Person mit EU-Staatsangehörigkeit (nicht deutsch): testet EU-Führungszeugnis-Pflicht. Wenn `STLGS_IsEU__c = true` und weder 1. noch 2. Staatsangehörigkeit = "54" (deutsch), wird ein EU-Führungszeugnis verlangt.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| FirstName | `Pierre` |
| MiddleName | `Jean` |
| LastName | `Testinhaber-EU-{{Today}}` |
| Email | `pierre.testeu@example.com` |
| Phone | `0711-5554444` |
| OtherStreet | `Schloßstraße 22` |
| OtherPostalCode | `70174` |
| OtherCity | `Stuttgart` |
| OtherCountry | `Germany` |
| Birthdate | `1990-03-22` |
| STLGS_Birthplace__c | `Lyon` |
| STLGS_Nationality__c | `72` |
| AccountId | `{{Ref:b2bPotentialStore}}` |
| referenceId | `contactLizenzinhaberEU` |

#### 3e. Lizenzinhaber — Nicht-EU (Türkei)

Antragsteller natürliche Person mit Nicht-EU-Staatsangehörigkeit: testet zusätzliche Unterlagen-Pflicht. Wenn `STLGS_IsEU__c = false`, müssen am Request `STLGS_ResidencePermit__c` (Aufenthaltserlaubnis) und `STLGS_PermissionSelfEmplyment__c` (Erlaubnis zur Selbstständigkeit) gesetzt werden.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| FirstName | `Mehmet` |
| MiddleName | `Ali` |
| LastName | `Testinhaber-NonEU-{{Today}}` |
| Email | `mehmet.testnoneu@example.com` |
| Phone | `0711-5555555` |
| OtherStreet | `Friedrichstraße 45` |
| OtherPostalCode | `70174` |
| OtherCity | `Stuttgart` |
| OtherCountry | `Germany` |
| Birthdate | `1988-11-08` |
| STLGS_Birthplace__c | `Istanbul` |
| STLGS_Nationality__c | `215` |
| AccountId | `{{Ref:b2bPotentialStore}}` |
| referenceId | `contactLizenzinhaberNonEU` |

#### 3f. Lizenzinhaber — Nicht-EU mit 2. Staatsangehörigkeit DE (Türkei + Deutschland)

Antragsteller natürliche Person: 1. Staatsangehörigkeit Nicht-EU, 2. Staatsangehörigkeit deutsch. `STLGS_IsEU__c = true` (via 2. Nationalität = 54). Da eine Nationalität = "54" (deutsch) vorliegt, wird **kein** EU-Führungszeugnis und **keine** Aufenthaltserlaubnis verlangt.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| FirstName | `Elif` |
| MiddleName | `Ayşe` |
| LastName | `Testinhaber-NonEU-DE-{{Today}}` |
| Email | `elif.testnoneu-de@example.com` |
| Phone | `0711-5556666` |
| OtherStreet | `Calwer Straße 12` |
| OtherPostalCode | `70173` |
| OtherCity | `Stuttgart` |
| OtherCountry | `Germany` |
| Birthdate | `1992-04-18` |
| STLGS_Birthplace__c | `Ankara` |
| STLGS_Nationality__c | `215` |
| STLGS_Nationality2__c | `54` |
| AccountId | `{{Ref:b2bPotentialStore}}` |
| referenceId | `contactLizenzinhaberNonEU_DE` |

#### 3g. Lizenzinhaber — Nicht-EU mit 2. Staatsangehörigkeit EU (Türkei + Frankreich)

Antragsteller natürliche Person: 1. Staatsangehörigkeit Nicht-EU, 2. Staatsangehörigkeit EU (nicht deutsch). `STLGS_IsEU__c = true` (via 2. Nationalität = 72). Da **keine** Nationalität = "54" (deutsch), wird ein **EU-Führungszeugnis** verlangt. Keine Aufenthaltserlaubnis nötig (IsEU = true).

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| FirstName | `Deniz` |
| MiddleName | `Emre` |
| LastName | `Testinhaber-NonEU-EU-{{Today}}` |
| Email | `deniz.testnoneu-eu@example.com` |
| Phone | `0711-5557777` |
| OtherStreet | `Eberhardstraße 33` |
| OtherPostalCode | `70173` |
| OtherCity | `Stuttgart` |
| OtherCountry | `Germany` |
| Birthdate | `1987-09-03` |
| STLGS_Birthplace__c | `Istanbul` |
| STLGS_Nationality__c | `215` |
| STLGS_Nationality2__c | `72` |
| AccountId | `{{Ref:b2bPotentialStore}}` |
| referenceId | `contactLizenzinhaberNonEU_EU` |

---

### 4. AccountContactRelation Updates

These are UPDATE operations on the auto-created ACR records (Salesforce creates ACRs automatically when a Contact is linked to an Account). The skill must query the ACR by AccountId + ContactId, then update the custom fields.

#### 4a. ACR: Store VollASt ↔ Lizenzinhaber

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bStoreVollASt}}, ContactId={{Ref:contactLizenzinhaber}}` |
| STLGS_LicenseOwner__c | `true` |
| STLGS_MainContact__c | `true` |
| STLGS_Role__c | `Geschäftsinhaber` |
| IsActive | `true` |

#### 4b. ACR: Store LK ↔ Filialverantwortliche

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bStoreLK}}, ContactId={{Ref:contactFilialverantwortliche}}` |
| STLGS_LicenseOwner__c | `false` |
| STLGS_MainContact__c | `true` |
| STLGS_Role__c | `Filialleiter` |
| IsActive | `true` |

#### 4c. ACR: Business Account ↔ Geschäftsführer

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bBusinessAccount}}, ContactId={{Ref:contactGF}}` |
| STLGS_ManagingDirector__c | `true` |
| STLGS_MainContact__c | `true` |
| IsActive | `true` |

#### 4d. ACR: Pot. Store ↔ EU-Lizenzinhaber

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bPotentialStore}}, ContactId={{Ref:contactLizenzinhaberEU}}` |
| STLGS_LicenseOwner__c | `true` |
| STLGS_MainContact__c | `true` |
| STLGS_Role__c | `Geschäftsinhaber` |
| IsActive | `true` |

#### 4e. ACR: Pot. Store ↔ Non-EU-Lizenzinhaber

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bPotentialStore}}, ContactId={{Ref:contactLizenzinhaberNonEU}}` |
| STLGS_LicenseOwner__c | `false` |
| STLGS_MainContact__c | `false` |
| STLGS_Role__c | `Geschäftsinhaber` |
| IsActive | `true` |

> **Note:** `STLGS_LicenseOwner__c` is `false` for 4e, 4f, and 4g because a uniqueness constraint (`STLGS_LicenseOwnerUnique__c`) allows only one License Owner per Account. The EU-Lizenzinhaber (4d) already holds this role on the same Pot. Store.

#### 4f. ACR: Pot. Store ↔ Non-EU+DE-Lizenzinhaber

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bPotentialStore}}, ContactId={{Ref:contactLizenzinhaberNonEU_DE}}` |
| STLGS_LicenseOwner__c | `false` |
| STLGS_MainContact__c | `false` |
| STLGS_Role__c | `Geschäftsinhaber` |
| IsActive | `true` |

#### 4g. ACR: Pot. Store ↔ Non-EU+EU-Lizenzinhaber

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bPotentialStore}}, ContactId={{Ref:contactLizenzinhaberNonEU_EU}}` |
| STLGS_LicenseOwner__c | `false` |
| STLGS_MainContact__c | `false` |
| STLGS_Role__c | `Geschäftsinhaber` |
| IsActive | `true` |

---

### 5. Requests (Anträge)

All requests reference a Store via `STLGS_Store__c` (MasterDetail to Account).

#### 5a. Request: Neueröffnung — natürliche Person

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bStoreVollASt}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaber}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+42d}}` |
| referenceId | `requestNeueroeffnungNP` |

#### 5b. Request: Übernahme — natürliche Person

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bStoreVollASt}}` |
| STLGS_Type__c | `Übernahme` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaber}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+28d}}` |
| referenceId | `requestUebernahmeNP` |

#### 5c. Request: Neueröffnung — juristische Person

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_BusinessRequest` |
| STLGS_Store__c | `{{Ref:b2bStoreLK}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Lotto Kompakt` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_BusinessAccount__c | `{{Ref:b2bBusinessAccount}}` |
| STLGS_BranchManager__c | `{{Ref:contactFilialverantwortliche}}` |
| STLGS_ManagingDirector__c | `{{Ref:contactGF}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+42d}}` |
| referenceId | `requestNeueroeffnungJP` |

#### 5d. Request: Verlegung — natürliche Person

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bStoreVollASt}}` |
| STLGS_Type__c | `Verlegung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaber}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+42d}}` |
| referenceId | `requestVerlegung` |

#### 5e. Request: Neueröffnung — natürliche Person, EU-Ausländer (Frankreich)

Testet EU-Führungszeugnis-Pflicht: Contact hat `STLGS_Nationality__c = 72` (France), `STLGS_IsEU__c = true`, aber keine deutsche Staatsangehörigkeit.

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bPotentialStore}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaberEU}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+42d}}` |
| referenceId | `requestNeueroeffnungEU` |

#### 5f. Request: Neueröffnung — natürliche Person, Nicht-EU (Türkei)

Testet zusätzliche Unterlagen: Contact hat `STLGS_Nationality__c = 215` (Turkey), `STLGS_IsEU__c = false`. Am Request müssen `STLGS_ResidencePermit__c` und `STLGS_PermissionSelfEmplyment__c` gesetzt sein.

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bPotentialStore}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaberNonEU}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+42d}}` |
| STLGS_ResidencePermit__c | `true` |
| STLGS_PermissionSelfEmplyment__c | `true` |
| referenceId | `requestNeueroeffnungNonEU` |

#### 5g. Request: Neueröffnung — Nicht-EU mit 2. Staatsangehörigkeit DE

Testet Doppelstaatler: Contact hat `STLGS_Nationality__c = 215` (Turkey), `STLGS_Nationality2__c = 54` (Germany), `STLGS_IsEU__c = true`. Da eine Nationalität = "54" (deutsch), wird **kein** EU-Führungszeugnis und **keine** Aufenthaltserlaubnis verlangt.

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bPotentialStore}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaberNonEU_DE}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+42d}}` |
| referenceId | `requestNeueroeffnungNonEU_DE` |

#### 5h. Request: Neueröffnung — Nicht-EU mit 2. Staatsangehörigkeit EU (nicht deutsch)

Testet Doppelstaatler: Contact hat `STLGS_Nationality__c = 215` (Turkey), `STLGS_Nationality2__c = 72` (France), `STLGS_IsEU__c = true`. Da **keine** Nationalität = "54" (deutsch), wird ein **EU-Führungszeugnis** verlangt. Keine Aufenthaltserlaubnis nötig (IsEU = true).

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bPotentialStore}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaberNonEU_EU}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+42d}}` |
| referenceId | `requestNeueroeffnungNonEU_EU` |

---

### 6. B2C Cases

#### 6a. Case: Allgemeines Anliegen (B2C)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLG_StandardCase` |
| AccountId | `{{Ref:b2cCustomer}}` |
| Subject | `Test B2C Allgemeines Anliegen {{Today}}` |
| Type | `Allgemeines` |
| Status | `Neu` |
| Origin | `Phone` |
| Description | `Testfall B2C allgemeines Anliegen` |
| referenceId | `caseB2CAllgemein` |

#### 6b. Case: Gewinne (B2C)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLG_StandardCase` |
| AccountId | `{{Ref:b2cCustomer}}` |
| Subject | `Test Gewinnauskunft {{Today}}` |
| Type | `Gewinne` |
| Status | `Neu` |
| Description | `Testfall B2C Gewinnanfrage` |
| referenceId | `caseB2CGewinne` |

#### 6c. Case: Erwin (B2C Online-Plattform)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLG_ErwinCase` |
| AccountId | `{{Ref:b2cCustomer}}` |
| Subject | `Test Erwin Kundenkonto {{Today}}` |
| Type | `ERWIN_Kundenkonto` |
| Status | `Neu` |
| Origin | `Web` |
| Description | `Testfall Erwin Online-Plattform` |
| referenceId | `caseErwin` |

---

### 7. B2B Cases — on Store Vollannahmestelle

#### 7a. Case: Service Desk (B2B)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_ServiceDeskCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test B2B Service Desk {{Today}}` |
| Status | `Neu` |
| Origin | `Phone` |
| STLGS_SubjectSD__c | `Allgemeine Anfrage` |
| STLGS_TopicArea__c | `General__c` |
| Description | `Testfall B2B Service Desk — allgemeine technische Anfrage` |
| referenceId | `caseServiceDeskB2B` |

#### 7b. Case: VDE Prüfung (Electrical Safety Inspection)

VDE uses the ServiceDeskCase RecordType with `STLGS_TopicArea__c = "VDE Prüfung"`. This triggers the Flow `STLGS_CreateAssetsVDECases` which auto-creates Assets based on `Account.STLGS_SalesType__c`.

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_ServiceDeskCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test VDE Prüfung {{Today}}` |
| Status | `Neu` |
| STLGS_TopicArea__c | `VDE Prüfung` |
| STLGS_SubjectSD__c | `VDE Prüfung` |
| Description | `Testfall VDE Prüfung — Vollannahmestelle (12 Assets erwartet)` |
| referenceId | `caseVDEPruefungVollASt` |

#### 7c. Case: VDE Prüfung — Lotto Kompakt

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_ServiceDeskCase` |
| AccountId | `{{Ref:b2bStoreLK}}` |
| ContactId | `{{Ref:contactFilialverantwortliche}}` |
| Subject | `Test VDE Prüfung LK {{Today}}` |
| Status | `Neu` |
| STLGS_TopicArea__c | `VDE Prüfung` |
| STLGS_SubjectSD__c | `VDE Prüfung` |
| Description | `Testfall VDE Prüfung — Lotto Kompakt (7 Assets erwartet)` |
| referenceId | `caseVDEPruefungLK` |

#### 7d. Case: Testkauf (Test Purchase)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_TestPurchase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Testkauf {{Today}}` |
| Status | `Neu` |
| STLGS_TypeTestPurchase__c | `Jugendschutz` |
| STLGS_KindTestPurchase__c | `Ersttest` |
| STLGS_TestPurchaseExecutionDate__c | `{{Today}}` |
| Description | `Testfall Testkauf — Ersttest Jugendschutz` |
| referenceId | `caseTestkauf` |

#### 7e. Case: Pflichtschulung Präsenz (Mandatory Training — In-Person)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Pflichtschulung Präsenz {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Pflichtschulung Jugend- und Spielerschutz` |
| STLGS_TrainingType__c | `Präsenz` |
| STLGS_TrainingYear__c | `{{Year}}` |
| STLGS_LeadingRequest__c | `{{Ref:requestNeueroeffnungNP}}` |
| Description | `Testfall Pflichtschulung Präsenz` |
| referenceId | `casePflichtschulungPraesenz` |

#### 7f. Case: Pflichtschulung Online (Mandatory Training — E-Learning)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Pflichtschulung Online {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Pflichtschulung Jugend- und Spielerschutz` |
| STLGS_TrainingType__c | `Online` |
| STLGS_TrainingYear__c | `{{Year}}` |
| STLGS_LeadingRequest__c | `{{Ref:requestNeueroeffnungNP}}` |
| Description | `Testfall Pflichtschulung Online` |
| referenceId | `casePflichtschulungOnline` |

#### 7g. Case: Kündigung (Termination — by ASt)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Kündigung durch ASt {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Kündigung` |
| STLGS_TerminationType__c | `Kündigung` |
| STLGS_TerminatedBy__c | `Annahmestelle` |
| STLGS_TerminationReason__c | `Geschäftsaufgabe - Alter` |
| Description | `Testfall Kündigung durch Annahmestelle — Geschäftsaufgabe Alter` |
| referenceId | `caseKuendigungASt` |

#### 7h. Case: Änderung vertragsrelevanter Daten (Contract Data Change)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Vertragsrelevante Daten {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Änderung vertragsrelevanter Daten` |
| Description | `Testfall Änderung vertragsrelevanter Daten` |
| referenceId | `caseVertragsdaten` |

#### 7i. Case: Bankdaten (Bank Data Change)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Bankdaten-Änderung {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Bankdaten` |
| Description | `Testfall Bankdaten-Änderung` |
| referenceId | `caseBankdaten` |

#### 7j. Case: Rücklastschrift (Return Debit)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Rücklastschrift {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Rücklastschrift` |
| Description | `Testfall Rücklastschrift` |
| referenceId | `caseRuecklastschrift` |

#### 7k. Case: Kontrollbesuch (Control Report)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_ControlReport` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Kontrollbesuch {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Kontrollbesuch` |
| Description | `Testfall Kontrollbesuch` |
| referenceId | `caseKontrollbesuch` |

#### 7l. Case: Terminallaufzeiten (Terminal Runtime)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Terminallaufzeiten {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Terminallaufzeiten` |
| Description | `Testfall Terminallaufzeiten-Änderung` |
| referenceId | `caseTerminallaufzeiten` |

#### 7m. Case: Bestellung (Order)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_SalesCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Bestellung {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Bestellung RD` |
| Origin | `Phone` |
| Description | `Testfall Bestellung durch RD` |
| referenceId | `caseBestellung` |

#### 7n. Case: Wartung Thermodrucker (Thermal Printer Maintenance)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_ServiceDeskCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| Subject | `Test Wartung Thermodrucker {{Year}}` |
| Status | `Zugewiesen an 2nd Level` |
| STLGS_TopicArea__c | `Wartung__c` |
| STLGS_ChecksToKBDone__c | `true` |
| STLGS_ProServicesCase__c | `true` |
| Description | `Testfall Thermodruckerwartung` |
| referenceId | `caseWartung` |

#### 7o. Case: Filialverantwortung ändern (Branch Manager Change)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactFilialverantwortliche}}` |
| Subject | `Test Filialverantwortung ändern {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Filialverantwortung ändern` |
| STLGS_ValidFrom__c | `{{Today+30d}}` |
| Origin | `Email` |
| Description | `Testfall Filialverantwortung wechseln — juristische Person` |
| referenceId | `caseFVWechsel` |

#### 7p. Case: Kündigung durch Lotto (Termination — by STLG)

| Field | Value |
|-------|-------|
| sObject | `Case` |
| RecordType | `STLGS_EditCase` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| ContactId | `{{Ref:contactLizenzinhaber}}` |
| Subject | `Test Kündigung durch Lotto {{Today}}` |
| Status | `Neu` |
| STLGS_Type__c | `Kündigung` |
| STLGS_TerminationType__c | `Kündigung` |
| STLGS_TerminatedBy__c | `Lotto` |
| STLGS_TerminationReason__c | `Fristl. Kündigung - Zahlungsschwierigkeiten` |
| Description | `Testfall Kündigung durch Lotto — Zahlungsschwierigkeiten` |
| referenceId | `caseKuendigungLotto` |

---

### 8. Visit Reports (Besuchsberichte)

Visit Reports are a separate custom object (`STLGS_VisitReport__c`), NOT Cases.

#### 8a. Visit Report (Besuchsbericht)

| Field | Value |
|-------|-------|
| sObject | `STLGS_VisitReport__c` |
| RecordType | `STLGS_StandardVisitReport` |
| STLGS_Account__c | `{{Ref:b2bStoreVollASt}}` |
| STLGS_Type__c | `Regelbesuch` |
| STLGS_Status__c | `Neu` |
| STLGS_DueDate__c | `{{Today+14d}}` |
| STLGS_Description__c | `Testfall Besuchsbericht — Regelbesuch` |
| referenceId | `visitReport` |

---

### 9. Assets (VDE Inspection Assets)

These are manually defined test assets. Note: The VDE Flow (`STLGS_CreateAssetsVDECases`) auto-creates assets when a VDE Case is created — these manual assets are for testing inspection workflows independently.

#### 9a. Asset: Terminal & Drucker

| Field | Value |
|-------|-------|
| sObject | `Asset` |
| Name | `Test Terminal {{Today}}` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| Case__c | `{{Ref:caseVDEPruefungVollASt}}` |
| STLGS_Type__c | `Terminal & Drucker` |
| STLGS_InspectionDate__c | `{{Today}}` |
| STLGS_ErrorFound__c | `false` |
| STLGS_InspectionStickerApplied__c | `true` |
| referenceId | `assetTerminal` |

#### 9b. Asset: Lottowand

| Field | Value |
|-------|-------|
| sObject | `Asset` |
| Name | `Test Lottowand {{Today}}` |
| AccountId | `{{Ref:b2bStoreVollASt}}` |
| Case__c | `{{Ref:caseVDEPruefungVollASt}}` |
| STLGS_Type__c | `Lottowand` |
| STLGS_InspectionDate__c | `{{Today}}` |
| STLGS_ErrorFound__c | `true` |
| STLGS_InspectionStickerApplied__c | `false` |
| referenceId | `assetLottowand` |

---

## Dependency Order

B2C and B2B are **independent paths** — they share no dependencies.

### B2C Path (Person Accounts)

1. **Person Accounts** (`STLG_StandardPersonAccount`) — these ARE the contacts (PersonAccount model)
2. **B2C Cases** — Need Person Account IDs from step 1

### Prerequisite (both paths)

0. **Lotto BW Company Account** (`STLGS_BusinessAccount`) — internal company account, created once (skip if already exists)
0b. **Test User Lookups** — query existing active users by role (e.g., "RD Stuttgart"), store IDs as references for OwnerId assignment

### B2B Path (Business Accounts + Sales Contacts)

1. **Business Account** (`STLGS_BusinessAccount`) — test business customer for juristische Person (GBV)
2. **Stores** (`STLGS_Store`, `STLGS_PotentialStore`) — juristische Person needs BusinessAccount as `ParentId`; natürliche Person has NO parent
3. **Sales Contacts** (`STLGS_SalesContact`) — Need Store/BusinessAccount IDs from steps 1–2
4. **ACR Updates** — Need Account IDs + Contact IDs from steps 1–3 (query existing ACR, then update custom fields)
5. **Requests** — Need Store IDs from step 2 and Contact IDs from step 3
6. **B2B Cases** — Need Store IDs from step 2, Contact IDs from step 3, and optionally Request IDs from step 5
7. **Visit Reports** — Need Store IDs from step 2
8. **Assets** — Need Store IDs from step 2 and Case IDs from step 6

## Notes

- All `{{Today}}` tokens are replaced with the current date (YYYY-MM-DD) to make test data identifiable
- All `{{Today+Nd}}` tokens are replaced with current date plus N days
- All `{{Year}}` tokens are replaced with the current year
- All `{{Ref:<referenceId>}}` tokens are replaced with the Salesforce ID of the referenced record created earlier
- Person Account fields (FirstName, LastName, PersonEmail) are only valid when the Account RecordType is a PersonAccount type (`STLG_StandardPersonAccount`)
- Record Type DeveloperNames are verified against the repository metadata — the skill queries the actual RecordType IDs at runtime
- Field API names follow domain knowledge from `domain-knowledge.md` — use exact spelling to avoid deployment errors
- **ACR records** (section 4) are UPDATE operations, not inserts — Salesforce auto-creates ACRs when Contacts are linked to Accounts
- **Section 0 (Company Account)** uses a fixed name — the skill must query for an existing account with the same name before creating, and skip if found (storing the existing Id as `lottoBWCompanyAccount` reference)
- **VDE Cases** (7b, 7c) trigger the Flow `STLGS_CreateAssetsVDECases` which auto-creates Assets — the manual Assets in section 9 are independent test records
- The Request field `STLGS_Store__c` is a MasterDetail to Account (filtered to Store record types)
- The standard `Type` field (without prefix) on Case is used for B2C case categorization; `STLGS_Type__c` is used for B2B case categorization
- **Nationality codes** use the `STLG_Nationality` global value set: `54` = Germany, `72` = France, `215` = Turkey, `13` = Austria
- **Antragsteller natürliche Person** needs: private address (Other fields: `OtherStreet`, `OtherPostalCode`, `OtherCity`, `OtherCountry`), Birthdate, `STLGS_Birthplace__c`, `STLGS_Nationality__c` on Contact. Note: Mailing fields are auto-populated by migration/automation — do NOT use them for private address.
- **Filialverantwortliche** (jur. Person) do NOT need private address — the Antragsteller is the Business Account
- **EU non-German** (`STLGS_IsEU__c = true`, neither nationality = "54"): EU-Führungszeugnis required
- **Non-EU** (`STLGS_IsEU__c = false`): Request needs `STLGS_ResidencePermit__c = true` + `STLGS_PermissionSelfEmplyment__c = true`
- **Dual nationality** (`STLGS_Nationality2__c`): `STLGS_IsEU__c` checks BOTH nationalities — if either is EU, `IsEU = true`. EU-FZ is only required when `IsEU = true` AND neither nationality = "54" (deutsch)
- **Nationality test matrix**: 3b=DE, 3d=EU, 3e=NonEU, 3f=NonEU+DE, 3g=NonEU+EU — covers all permutations

## Process Coverage Matrix

| Business Process | Covered By | Record Type | Key Differentiator |
| --- | --- | --- | --- |
| Neueröffnung (nat. Person) | 5a | `STLGS_StandardRequest` | `STLGS_Type__c = Neueröffnung` |
| Neueröffnung (jur. Person) | 5c | `STLGS_BusinessRequest` | `STLGS_Type__c = Neueröffnung` |
| Übernahme | 5b | `STLGS_StandardRequest` | `STLGS_Type__c = Übernahme` |
| Verlegung | 5d | `STLGS_StandardRequest` | `STLGS_Type__c = Verlegung` |
| Neueröffnung (EU-Ausländer) | 5e | `STLGS_StandardRequest` | EU-Führungszeugnis-Pflicht |
| Neueröffnung (Nicht-EU) | 5f | `STLGS_StandardRequest` | Aufenthalts-/Gewerbeerlaubnis |
| Neueröffnung (NonEU + DE) | 5g | `STLGS_StandardRequest` | Doppelstaatler, keine Sonderunterlagen |
| Neueröffnung (NonEU + EU) | 5h | `STLGS_StandardRequest` | Doppelstaatler, EU-FZ Pflicht |
| Service Desk (B2B) | 7a | `STLGS_ServiceDeskCase` | `STLGS_TopicArea__c = General__c` |
| VDE Prüfung (VollASt) | 7b | `STLGS_ServiceDeskCase` | `STLGS_TopicArea__c = VDE Prüfung` |
| VDE Prüfung (LK) | 7c | `STLGS_ServiceDeskCase` | `STLGS_TopicArea__c = VDE Prüfung` |
| Testkauf | 7d | `STLGS_TestPurchase` | — |
| Pflichtschulung Präsenz | 7e | `STLGS_EditCase` | `STLGS_TrainingType__c = Präsenz` |
| Pflichtschulung Online | 7f | `STLGS_EditCase` | `STLGS_TrainingType__c = Online` |
| Kündigung durch ASt | 7g | `STLGS_EditCase` | `STLGS_TerminatedBy__c = Annahmestelle` |
| Vertragsrel. Datenänderung | 7h | `STLGS_EditCase` | `STLGS_Type__c = Änderung vertragsrelevanter Daten` |
| Bankdaten | 7i | `STLGS_EditCase` | `STLGS_Type__c = Bankdaten` |
| Rücklastschrift | 7j | `STLGS_EditCase` | `STLGS_Type__c = Rücklastschrift` |
| Kontrollbesuch | 7k | `STLGS_ControlReport` | `STLGS_Type__c = Kontrollbesuch` |
| Terminallaufzeiten | 7l | `STLGS_EditCase` | `STLGS_Type__c = Terminallaufzeiten` |
| Bestellung | 7m | `STLGS_SalesCase` | `STLGS_Type__c = Bestellung RD` |
| Wartung Thermodrucker | 7n | `STLGS_ServiceDeskCase` | `STLGS_TopicArea__c = Wartung__c` |
| Filialverantwortung ändern | 7o | `STLGS_EditCase` | `STLGS_Type__c = Filialverantwortung ändern` |
| Kündigung durch Lotto | 7p | `STLGS_EditCase` | `STLGS_TerminatedBy__c = Lotto` |
| B2C Allgemein | 6a | `STLG_StandardCase` | `Type = Allgemeines` |
| B2C Gewinne | 6b | `STLG_StandardCase` | `Type = Gewinne` |
| B2C Erwin | 6c | `STLG_ErwinCase` | `Type = ERWIN_Kundenkonto` |
| Besuchsbericht | 8a | `STLGS_VisitReport__c` | Eigenes Objekt |
| VDE Asset-Prüfung | 9a, 9b | `Asset` | Manuelle Test-Assets |
