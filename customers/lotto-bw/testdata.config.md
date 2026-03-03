# Test Data Configuration: Lotto Baden-Württemberg

## Overview

This configuration defines the test data records to be created in a Lotto-BW Salesforce org. Records are organized by dependency order — parent records are created first.

### Antragsnummer / StoreNumber

Die Antragsnummer (`STLGS_Request__c.Name`) ist ein **Text-Feld** (kein AutoNumber) und entspricht der 6-stelligen ASt-Nummer. Sie ist gekoppelt mit `Account.STLGS_StoreNumber__c` — beide Felder tragen denselben Wert.

**Nummernbereiche in Produktion (nach Regionaldirektion):**

| RD | Bereich | Prod-Max (Stand 03/2026) |
|----|---------|--------------------------|
| RD 01 | 100000–199999 | ~118700 |
| RD 02 | 200000–299999 | ~261211 |
| RD 03 | 300000–399999 | ~309891 |
| RD 04 | 400000–499999 | ~462830 |
| RD 05 | 500000–599999 | ~508960 |
| RD 06 | 600000–699999 | ~609090 |
| RD 07 | 700000–799999 | ~757730 |

**Testdaten-Nummernlogik:** Feste Testnummern am oberen Ende des RD-Bereichs: `X99901`, `X99902`, etc. (weit entfernt von Prod-Nummern). Die RD-Nummer wird aus `User.UserRole.DeveloperName` extrahiert (`STLGS_RD0X` → X).

**Regeln:**
- **Neueröffnung / Übernahme:** Neue Nummer vergeben → auf `Account.STLGS_StoreNumber__c` + `Request.Name` setzen
- **Verlegung:** Gleiche Nummer wie der bestehende Store — `Request.Name` wird aus `Account.STLGS_StoreNumber__c` übernommen
- VR `STLGS_ValidateNameOnUpdate` erzwingt `^[0-9]{6}$` bei jeder Namensänderung

**Suffix-Allocation pro Preset:**

| Bereich | Suffix | Preset / Script | Verwendung |
|---------|--------|-----------------|------------|
| Standard | 99901 | NE-NP, NE-JP, VL-NP, VL-JP, Agentur-NP, ÜN (Pred), Nat. (Store) | Basis-Store + Basis-Request |
| Standard | 99902 | ÜN-NP, ÜN-JP | Neuer Store bei Übernahme |
| Nachreichen | 99903 | nachreichen-test | Store ohne Bankdaten |
| Nachreichen | 99904 | nachreichen-test | 2. Request (5r) |
| Flow-Tests | 99905 | flow-test T3 | VL ohne Vorgänger-AZ |
| Flow-Tests | 99906 | flow-test T4 | VL mit mehreren Vorgängern |
| Nationalität | 99911–14 | nationalitaet-szenarien | 4 NE-Requests (EU/NonEU/Mix) |
| Aktenzeichen | 99920–25 | aktenzeichen-crm3053 S1–S6 | FileNumberRP-Tests |
| Negativ | 99930 | negativ-uebernahme-noaz | Predecessor ohne AZ |
| Negativ | 99931 | negativ-uebernahme-noaz | Neuer Store |
| Negativ | 99932 | negativ-verlegung-alone | Alleiniger VL-Store |

> **Regel:** Standardpresets (NE, ÜN, VL, Agentur) teilen sich bewusst 99901 — sie sind nicht für gleichzeitige Nutzung gedacht. Spezial-Presets (Nachreichen, Flow-Tests, Nationalität, Aktenzeichen, Negativ) haben jeweils eigene Bereiche.

## Record Groups

---

### 0. Internal Company Account

> **Sektion 0** | Tags: `prerequisites` | Abhängigkeiten: — | Beschreibung: Company Account (skip if exists) + RD-User Lookups — immer erforderlich für B2B

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

#### 0b-i. District: Stuttgart

| Field | Value |
|-------|-------|
| sObject | `STLGS_District__c` |
| operation | `lookup` |
| lookupQuery | `SELECT Id FROM STLGS_District__c WHERE Name = 'Stuttgart, Landeshauptstadt' LIMIT 1` |
| referenceId | `districtStuttgart` |

#### 0b-ii. User: Regionaldirektion 1

| Field | Value |
|-------|-------|
| sObject | `User` |
| operation | `lookup` |
| lookupQuery | `SELECT Id FROM User WHERE UserRole.Name LIKE 'RD%' AND IsActive = true ORDER BY UserRole.Name ASC LIMIT 1` |
| referenceId | `userRD1` |

#### 0b-iii. User: Regionaldirektion 2

| Field | Value |
|-------|-------|
| sObject | `User` |
| operation | `lookup` |
| lookupQuery | `SELECT Id FROM User WHERE UserRole.Name LIKE 'RD%' AND IsActive = true ORDER BY UserRole.Name ASC LIMIT 1 OFFSET 1` |
| referenceId | `userRD2` |

> **Note:** Queries two distinct active users whose role starts with "RD" (e.g., "RD Stuttgart" and "RD Karlsruhe"). Uses ORDER BY + OFFSET to get deterministic, different results. If only one RD user exists, `userRD2` falls back to the running user. Adjust the LIKE filter per org if needed.

---

### 1. B2C Person Accounts

> **Sektion 1** | Tags: `b2c`, `person-account` | Abhängigkeiten: — | Records: 2 | Beschreibung: B2C Person Accounts (Prospect + Bestandskunde)

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

> **Sektion 2** | Tags: `b2b`, `account`, `store` | Abhängigkeiten: Sek. 0 | Records: 5 | Beschreibung: B2B Accounts & Stores (Business Account, Potenzielle ASt, VollASt, Lotto Kompakt, Vorgänger-ASt für Übernahme)

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
| STLGS_StoreTerm__c | `Test Pot. ASt {{Today}}` |
| STLGS_District__c | `{{Ref:districtStuttgart}}` |
| STLGS_Email__c | `test.potast@example.com` |
| STLGS_IBAN__c | `DE89370400440532013000` |
| STLGS_BIC__c | `COBADEFFXXX` |
| STLGS_Bankname__c | `Commerzbank Stuttgart` |
| STLGS_BankAccountType__c | `Geschäftskonto` |
| STLGS_LastCompanyName__c | `Test Pot. ASt {{Today}}` |
| STLGS_Street__c | `Marktplatz 5` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_StoreNumber__c | `{{StoreNumber}}` |
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
| STLGS_StoreStatus__c | `Potentielle Ast` |
| STLGS_StoreContractType__c | `natural person` |
| STLGS_StoreTerm__c | `Test ASt VollASt {{Today}}` |
| STLGS_District__c | `{{Ref:districtStuttgart}}` |
| STLGS_Email__c | `test.vollast@example.com` |
| STLGS_IBAN__c | `DE89370400440532013001` |
| STLGS_BIC__c | `COBADEFFXXX` |
| STLGS_Bankname__c | `Sparkasse Stuttgart` |
| STLGS_BankAccountType__c | `Geschäftskonto` |
| STLGS_LastCompanyName__c | `Test ASt VollASt {{Today}}` |
| STLGS_Street__c | `Hauptstraße 42` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_StoreNumber__c | `{{StoreNumber}}` |
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
| STLGS_StoreStatus__c | `Potentielle Ast` |
| STLGS_StoreContractType__c | `legal person` |
| STLGS_StoreTerm__c | `Test ASt LK {{Today}}` |
| STLGS_District__c | `{{Ref:districtStuttgart}}` |
| STLGS_Email__c | `test.lk@example.com` |
| STLGS_IBAN__c | `DE89370400440532013002` |
| STLGS_BIC__c | `COBADEFFXXX` |
| STLGS_Bankname__c | `Volksbank Stuttgart` |
| STLGS_BankAccountType__c | `Geschäftskonto` |
| STLGS_LastCompanyName__c | `Test ASt LK {{Today}}` |
| STLGS_Street__c | `Bahnhofstraße 15` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_StoreNumber__c | `{{StoreNumber}}` |
| ParentId | `{{Ref:b2bBusinessAccount}}` |
| OwnerId | `{{Ref:userRD2}}` |
| referenceId | `b2bStoreLK` |

#### 2e. B2B Store — Vorgänger-ASt für Übernahme (mit Kündigungsdatum)

Vorgänger-Store für Übernahme-Test (5b). Status bleibt "Betriebsbereit" — eine Vorgänger-ASt muss noch nicht geschlossen sein, es reicht wenn ein Kündigungsdatum (`STLGS_TerminatedOn__c`) gesetzt ist. VR `STLGS_TerminatedOnEmpty` blockiert die Freigabe wenn das Kündigungsdatum fehlt.

> **Post-Creation Update:** Nach Erstellung von 2c und 2e müssen die bidirektionalen Verknüpfungen gesetzt werden: `STLGS_PredecessorStore__c` auf 2c → 2e, `STLGS_SuccessorStore__c` auf 2e → 2c. Diese Kreuzreferenz kann nicht im selben Composite-Tree-Batch erstellt werden.

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_Store` |
| Name | `Test Vorgänger-ASt {{Today}}` |
| Phone | `0711-5558888` |
| BillingStreet | `Alte Straße 1` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_StoreStatus__c | `Betriebsbereit` |
| STLGS_StoreContractType__c | `natural person` |
| STLGS_StoreTerm__c | `Test Vorgänger-ASt {{Today}}` |
| STLGS_District__c | `{{Ref:districtStuttgart}}` |
| STLGS_Email__c | `test.vorgaenger@example.com` |
| STLGS_TerminatedOn__c | `{{Today+60d}}` |
| STLGS_IBAN__c | `DE89370400440532013003` |
| STLGS_BIC__c | `COBADEFFXXX` |
| STLGS_Bankname__c | `Sparkasse Stuttgart` |
| STLGS_BankAccountType__c | `Geschäftskonto` |
| STLGS_LastCompanyName__c | `Test Vorgänger-ASt {{Today}}` |
| STLGS_Street__c | `Alte Straße 1` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_StoreNumber__c | `{{StoreNumber:X99901}}` |
| OwnerId | `{{Ref:userRD1}}` |
| referenceId | `b2bStorePredecessor` |

**Post-Creation Updates (nach Batch 1):**

| sObject | Id-Ref                | Field                     | Value                          |
|---------|-----------------------|---------------------------|--------------------------------|
| Account | `b2bStoreVollASt`     | STLGS_PredecessorStore__c | `{{Ref:b2bStorePredecessor}}`  |
| Account | `b2bStorePredecessor` | STLGS_SuccessorStore__c   | `{{Ref:b2bStoreVollASt}}`      |

#### 2f. B2B Potential Store — OHNE Bankdaten (für Nachreich-Tests CRM-2882/CRM-3057)

Potentielle ASt ohne IBAN/BIC/Bankname/BankAccountType. Wird für Tests der automatischen Nachreich-Flows (Bankdaten + Gewerbeanmeldung) benötigt, da alle anderen Stores bereits Bankdaten haben.

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_PotentialStore` |
| Name | `Test Pot. ASt ohne Bankdaten {{Today}}` |
| Phone | `0711-5550001` |
| BillingStreet | `Teststraße 10` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_StoreStatus__c | `Potentielle Ast` |
| STLGS_StoreTerm__c | `Test Pot. ASt ohne Bankdaten {{Today}}` |
| STLGS_District__c | `{{Ref:districtStuttgart}}` |
| STLGS_Email__c | `test.potast.nobankdata@example.com` |
| STLGS_LastCompanyName__c | `Test Pot. ASt ohne Bankdaten {{Today}}` |
| STLGS_Street__c | `Teststraße 10` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_StoreNumber__c | `{{StoreNumber:X99903}}` |
| OwnerId | `{{Ref:userRD1}}` |
| referenceId | `b2bPotentialStoreNoBankdata` |

#### 2g. B2B Store — Vorgänger-ASt für ÜN OHNE Aktenzeichen (Negativ-Test 5n)

Vorgänger-Store für Negativ-Test 5n (Übernahme ohne Vorgänger-AZ). Wie 2e, aber der zugehörige Vorgänger-Request hat KEIN `STLGS_FileNumberRP__c`.

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_Store` |
| Name | `Test Vorgänger-ASt ohne AZ {{Today}}` |
| Phone | `0711-5558801` |
| BillingStreet | `Alte Straße 2` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_StoreStatus__c | `Betriebsbereit` |
| STLGS_StoreContractType__c | `natural person` |
| STLGS_StoreTerm__c | `Test Vorgänger-ASt ohne AZ {{Today}}` |
| STLGS_District__c | `{{Ref:districtStuttgart}}` |
| STLGS_Email__c | `test.vorgaenger.noaz@example.com` |
| STLGS_TerminatedOn__c | `{{Today+60d}}` |
| STLGS_IBAN__c | `DE89370400440532013010` |
| STLGS_BIC__c | `COBADEFFXXX` |
| STLGS_Bankname__c | `Sparkasse Stuttgart` |
| STLGS_BankAccountType__c | `Geschäftskonto` |
| STLGS_LastCompanyName__c | `Test Vorgänger-ASt ohne AZ {{Today}}` |
| STLGS_Street__c | `Alte Straße 2` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_StoreNumber__c | `{{StoreNumber:X99905}}` |
| OwnerId | `{{Ref:userRD1}}` |
| referenceId | `b2bStorePredecessorNoAZ` |

#### 2h. B2B Store — Alleiniger VL-Store (Negativ-Test 5o)

Store für Negativ-Test 5o (Verlegung als einziger Request). Status "Betriebsbereit", KEIN anderer Request vorhanden. Damit der Snapshot-Flow `STLGS_CopyPreviousRPFileNumber` nichts finden kann.

| Field | Value |
|-------|-------|
| sObject | `Account` |
| RecordType | `STLGS_Store` |
| Name | `Test ASt Allein-VL {{Today}}` |
| Phone | `0711-5558802` |
| BillingStreet | `Einsame Straße 1` |
| BillingPostalCode | `70173` |
| BillingCity | `Stuttgart` |
| BillingCountry | `Germany` |
| STLGS_StoreStatus__c | `Betriebsbereit` |
| STLGS_StoreContractType__c | `natural person` |
| STLGS_StoreTerm__c | `Test ASt Allein-VL {{Today}}` |
| STLGS_District__c | `{{Ref:districtStuttgart}}` |
| STLGS_Email__c | `test.alleinvl@example.com` |
| STLGS_IBAN__c | `DE89370400440532013011` |
| STLGS_BIC__c | `COBADEFFXXX` |
| STLGS_Bankname__c | `Sparkasse Stuttgart` |
| STLGS_BankAccountType__c | `Geschäftskonto` |
| STLGS_LastCompanyName__c | `Test ASt Allein-VL {{Today}}` |
| STLGS_Street__c | `Einsame Straße 1` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_StoreNumber__c | `{{StoreNumber:X99906}}` |
| OwnerId | `{{Ref:userRD1}}` |
| referenceId | `b2bStoreAloneVL` |

> **Post-Creation Update:** Store muss nach Insert auf RecordType `STLGS_Store` + Status `Betriebsbereit` gesetzt werden (Flows ändern RT auf PotentialStore bei Request-Insert).

---

### 3. Contacts

> **Sektion 3** | Tags: `b2b`, `contact`, `nationality`, `antrag` | Abhängigkeiten: Sek. 0, 2 | Records: 9 | Beschreibung: Sales Contacts inkl. Nationalitäts-Szenarien (DE, EU, Nicht-EU, Doppelstaatler) + Lizenzinhaber an Predecessor-Stores

#### 3a. Geschäftsführer (Business Account)

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| Salutation | `Herr` |
| FirstName | `Max` |
| MiddleName | `Johann` |
| LastName | `Testgeschäftsführer-{{Today}}` |
| Email | `max.testgf@example.com` |
| Phone | `0711-5551111` |
| Birthdate | `1975-03-20` |
| STLGS_Birthplace__c | `München` |
| STLGS_Nationality__c | `54` |
| AccountId | `{{Ref:b2bBusinessAccount}}` |
| referenceId | `contactGF` |

#### 3b. Lizenzinhaber / ASt-Leiter (Store Vollannahmestelle — deutsch)

Antragsteller natürliche Person: braucht Privatanschrift (Other-Felder), Geburtsdaten und Staatsangehörigkeit.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| Salutation | `Frau` |
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
| Salutation | `Frau` |
| FirstName | `Lisa` |
| MiddleName | `Marie` |
| LastName | `Testfiliale-{{Today}}` |
| Email | `lisa.testfiliale@example.com` |
| Phone | `0711-5553333` |
| Birthdate | `1990-08-12` |
| STLGS_Birthplace__c | `Karlsruhe` |
| STLGS_Nationality__c | `54` |
| AccountId | `{{Ref:b2bStoreLK}}` |
| referenceId | `contactFilialverantwortliche` |

#### 3d. Lizenzinhaber — EU-Ausländer (Frankreich)

Antragsteller natürliche Person mit EU-Staatsangehörigkeit (nicht deutsch): testet EU-Führungszeugnis-Pflicht. Wenn `STLGS_IsEU__c = true` und weder 1. noch 2. Staatsangehörigkeit = "54" (deutsch), wird ein EU-Führungszeugnis verlangt.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| Salutation | `Herr` |
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
| Salutation | `Herr` |
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
| Salutation | `Frau` |
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
| Salutation | `Herr` |
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

#### 3h. Lizenzinhaber — Allein-VL-Store (für Negativ-Test 5o)

Contact für den alleinigen VL-Store (2h). Eigener Contact weil der Store keinen anderen Request/Contact haben darf.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| Salutation | `Herr` |
| FirstName | `Thomas` |
| MiddleName | `Peter` |
| LastName | `Testinhaber-AlleinVL-{{Today}}` |
| Email | `thomas.testalleinvl@example.com` |
| Phone | `0711-5558803` |
| OtherStreet | `Einsame Straße 1` |
| OtherPostalCode | `70173` |
| OtherCity | `Stuttgart` |
| OtherCountry | `Germany` |
| Birthdate | `1980-02-28` |
| STLGS_Birthplace__c | `Stuttgart` |
| STLGS_Nationality__c | `54` |
| AccountId | `{{Ref:b2bStoreAloneVL}}` |
| referenceId | `contactAloneVL` |

#### 3-pred. Contact: Alter Lizenzinhaber am Vorgänger-Store (für ÜN-Tests)

Bisheriger Lizenzinhaber am Predecessor Store (`b2bStorePredecessor`). Wird als `AccountLead` am Vorgänger-Request (5m) benötigt — ohne AccountLead sind die Testdaten nicht produktionsnah.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| Salutation | `Herr` |
| FirstName | `Alt` |
| LastName | `Testinhaber-{{Today}}` |
| Email | `alt.testinhaber.{{Today}}@example.com` |
| Phone | `0711-5559999` |
| OtherStreet | `Alte Straße 1` |
| OtherPostalCode | `70173` |
| OtherCity | `Stuttgart` |
| OtherCountry | `Germany` |
| Birthdate | `1970-04-15` |
| STLGS_Birthplace__c | `Stuttgart` |
| STLGS_Nationality__c | `54` |
| AccountId | `{{Ref:b2bStorePredecessor}}` |
| referenceId | `contactPredecessorLI` |

#### 3-pred-noaz. Contact: Alter Lizenzinhaber am Vorgänger-Store ohne AZ (für Negativ-Test 5n)

Analog zu 3-pred, aber am `b2bStorePredecessorNoAZ`. Wird als `AccountLead` am Vorgänger-Request ohne Aktenzeichen (5n-prereq) benötigt.

| Field | Value |
|-------|-------|
| sObject | `Contact` |
| RecordType | `STLGS_SalesContact` |
| Salutation | `Herr` |
| FirstName | `Alt` |
| LastName | `Testinhaber-NoAZ-{{Today}}` |
| Email | `alt.testinhaber.noaz.{{Today}}@example.com` |
| Phone | `0711-5559998` |
| OtherStreet | `Alte Straße 2` |
| OtherPostalCode | `70173` |
| OtherCity | `Stuttgart` |
| OtherCountry | `Germany` |
| Birthdate | `1968-07-22` |
| STLGS_Birthplace__c | `Stuttgart` |
| STLGS_Nationality__c | `54` |
| AccountId | `{{Ref:b2bStorePredecessorNoAZ}}` |
| referenceId | `contactPredecessorNoAZLI` |

---

### 4. AccountContactRelation Updates

> **Sektion 4** | Tags: `b2b`, `acr` | Abhängigkeiten: Sek. 0, 2, 3 | Records: 10 (Updates) | Beschreibung: ACR-Updates (Lizenzinhaber, Filialverantwortliche, Geschäftsführer, Predecessor-Lizenzinhaber — Rollen + Flags setzen)

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

#### 4h. ACR: Store Allein-VL ↔ Lizenzinhaber Allein-VL

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bStoreAloneVL}}, ContactId={{Ref:contactAloneVL}}` |
| STLGS_LicenseOwner__c | `true` |
| STLGS_MainContact__c | `true` |
| STLGS_Role__c | `Geschäftsinhaber` |
| IsActive | `true` |

#### 4-pred. ACR: Vorgänger-Store ↔ Alter Lizenzinhaber (für ÜN-Tests)

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bStorePredecessor}}, ContactId={{Ref:contactPredecessorLI}}` |
| STLGS_LicenseOwner__c | `true` |
| STLGS_MainContact__c | `true` |
| STLGS_Role__c | `Geschäftsinhaber` |
| IsActive | `true` |

#### 4-pred-noaz. ACR: Vorgänger-Store ohne AZ ↔ Alter Lizenzinhaber (für Negativ-Test 5n)

| Field | Value |
|-------|-------|
| sObject | `AccountContactRelation` |
| operation | `update` |
| lookupKey | `AccountId={{Ref:b2bStorePredecessorNoAZ}}, ContactId={{Ref:contactPredecessorNoAZLI}}` |
| STLGS_LicenseOwner__c | `true` |
| STLGS_MainContact__c | `true` |
| STLGS_Role__c | `Geschäftsinhaber` |
| IsActive | `true` |

---

### 5. Requests (Anträge)

> **Sektion 5** | Tags: `antrag`, `b2b`, `nationality`, `negativ-test`, `nachreichen` | Abhängigkeiten: Sek. 0, 2, 3, 4 | Records: 18 | Beschreibung: Anträge (Neueröffnung/Übernahme/Verlegung jeweils NP+JP, Agentur NP, EU/Nicht-EU/Doppelstaatler-Szenarien, Vorgänger-Request für Übernahme, Negativ-Tests FileNumberRP, Nachreich-Tests CRM-2882/CRM-3057) — **validierungsbereit für Prüfen/Freigabe**

All requests reference a Store via `STLGS_Store__c` (MasterDetail to Account). All requests include document/compliance checkboxes required by the `STLGS_DisplayMandatoryRequestFields` validation flow, so they can pass the "Prüfen" button validation and proceed through the full status lifecycle.

> **Vertragsbeginn-Formel (`STLGS_ContractStartCheck__c`):** Die VR prüft `ContractStartPlanned - TODAY() < (8 - WEEKDAY(TODAY()) + N)` wobei N=42 (Neueröffnung/Verlegung) bzw. N=28 (Übernahme). Durch die Wochentag-Korrektur (`8-WEEKDAY`) schwankt die Mindestfrist um bis zu 7 Tage. Sichere Werte: **+49d** (7 Wochen) für Neueröffnung/Verlegung, **+35d** (5 Wochen) für Übernahme. Verlegung prüft `TransferDate__c` statt `ContractStartPlanned__c`.

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
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Tabakgeschäft` |
| STLGS_Potential__c | `5000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 08:00-20:00, Sa 08:00-18:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Neueröffnung natürliche Person</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber}}` |
| referenceId | `requestNeueroeffnungNP` |

> **Hinweis:** `Name` = Antragsnummer = 6-stellige ASt-Nummer (siehe Overview-Sektion). Wird zusammen mit `Account.STLGS_StoreNumber__c` gesetzt. `STLGS_FileNumberRP__c` und `STLGS_SetLeadingAt__c` werden hier NICHT gesetzt — die gehören nur an historische/Vorgänger-Requests (siehe 5m, 5m-ii).

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
| STLGS_ContractStartPlanned__c | `{{Today+35d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Kiosk` |
| STLGS_Potential__c | `3000` |
| STLGS_IsStandardTaxation__c | `false` |
| STLGS_IsSmallBusinessOwner__c | `true` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 07:00-21:00, Sa 08:00-20:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Übernahme</p>` |
| STLGS_PredecessorStore__c | `{{Ref:b2bStorePredecessor}}` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99902}}` |
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
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Supermarkt` |
| STLGS_Potential__c | `2000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Sa 07:00-22:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Neueröffnung juristische Person</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasCommercialRegisterExtract__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber}}` |
| referenceId | `requestNeueroeffnungJP` |

#### 5c-ii. RequestContactRelation: Geschäftsführer → Neueröffnung JP

| Field | Value |
|-------|-------|
| sObject | `STLGS_RequestContactRelation__c` |
| Contact__c | `{{Ref:contactGF}}` |
| STLGS_Request__c | `{{Ref:requestNeueroeffnungJP}}` |
| STLGS_Type__c | `Managing Director` |
| referenceId | `rcrNeueroeffnungJP` |

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
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Schreibwaren` |
| STLGS_Potential__c | `4000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 09:00-18:30, Sa 09:00-14:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Verlegung</p>` |
| STLGS_Street__c | `Neue Straße 10` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_TransferDate__c | `{{Today+49d}}` |
| STLGS_AverageTurnoverPredecessor__c | `3800` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber}}` |
| referenceId | `requestVerlegungNP` |

> **Hinweis:** Verlegung übernimmt dieselbe ASt-Nummer wie der bestehende Store. `Name` = `Account.STLGS_StoreNumber__c` des Verlegungs-Stores.

#### 5e. Request: Übernahme — juristische Person

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_BusinessRequest` |
| STLGS_Store__c | `{{Ref:b2bStoreLK}}` |
| STLGS_Type__c | `Übernahme` |
| STLGS_SalesType__c | `Lotto Kompakt` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_BusinessAccount__c | `{{Ref:b2bBusinessAccount}}` |
| STLGS_BranchManager__c | `{{Ref:contactFilialverantwortliche}}` |
| STLGS_ManagingDirector__c | `{{Ref:contactGF}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+35d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Tankstelle` |
| STLGS_Potential__c | `3000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Sa 06:00-22:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Übernahme juristische Person</p>` |
| STLGS_PredecessorStore__c | `{{Ref:b2bStorePredecessor}}` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasCommercialRegisterExtract__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99902}}` |
| referenceId | `requestUebernahmeJP` |

#### 5e-ii. RequestContactRelation: Geschäftsführer → Übernahme JP

| Field | Value |
|-------|-------|
| sObject | `STLGS_RequestContactRelation__c` |
| Contact__c | `{{Ref:contactGF}}` |
| STLGS_Request__c | `{{Ref:requestUebernahmeJP}}` |
| STLGS_Type__c | `Managing Director` |
| referenceId | `rcrUebernahmeJP` |

#### 5f. Request: Verlegung — juristische Person

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_BusinessRequest` |
| STLGS_Store__c | `{{Ref:b2bStoreLK}}` |
| STLGS_Type__c | `Verlegung` |
| STLGS_SalesType__c | `Lotto Kompakt` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_BusinessAccount__c | `{{Ref:b2bBusinessAccount}}` |
| STLGS_BranchManager__c | `{{Ref:contactFilialverantwortliche}}` |
| STLGS_ManagingDirector__c | `{{Ref:contactGF}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Postfiliale` |
| STLGS_Potential__c | `2500` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 09:00-18:00, Sa 09:00-13:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Verlegung juristische Person</p>` |
| STLGS_Street__c | `Neue Straße 20` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_TransferDate__c | `{{Today+49d}}` |
| STLGS_AverageTurnoverPredecessor__c | `3800` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasCommercialRegisterExtract__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber}}` |
| referenceId | `requestVerlegungJP` |

> **Hinweis:** Verlegung übernimmt dieselbe ASt-Nummer wie der bestehende Store.

#### 5f-ii. RequestContactRelation: Geschäftsführer → Verlegung JP

| Field | Value |
|-------|-------|
| sObject | `STLGS_RequestContactRelation__c` |
| Contact__c | `{{Ref:contactGF}}` |
| STLGS_Request__c | `{{Ref:requestVerlegungJP}}` |
| STLGS_Type__c | `Managing Director` |
| referenceId | `rcrVerlegungJP` |

#### 5g. Request: Agenturstandort — natürliche Person

Neueröffnung mit Agentur-Flag: `STLGS_IsOperatedByAgency__c = true` erfordert zusätzlich `STLGS_ECCard__c = true` für die Vorort-Gespräch-Validierung.

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
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Postagentur` |
| STLGS_Potential__c | `4000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 09:00-18:00, Sa 09:00-13:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Neueröffnung Agenturstandort NP</p>` |
| STLGS_IsOperatedByAgency__c | `true` |
| STLGS_ECCard__c | `true` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber}}` |
| referenceId | `requestAgenturNP` |

#### 5i. Request: Neueröffnung — natürliche Person, EU-Ausländer (Frankreich)

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
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Lebensmittel-Einzelhandel` |
| STLGS_Potential__c | `4500` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Sa 08:00-20:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Neueröffnung EU-Ausländer</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99911}}` |
| referenceId | `requestNeueroeffnungEU` |

#### 5j. Request: Neueröffnung — natürliche Person, Nicht-EU (Türkei)

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
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_ResidencePermit__c | `true` |
| STLGS_PermissionSelfEmplyment__c | `true` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Getränkemarkt` |
| STLGS_Potential__c | `3500` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Sa 09:00-21:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Neueröffnung Nicht-EU</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99912}}` |
| referenceId | `requestNeueroeffnungNonEU` |

#### 5k. Request: Neueröffnung — Nicht-EU mit 2. Staatsangehörigkeit DE

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
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Bäckerei` |
| STLGS_Potential__c | `2500` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 06:00-18:00, Sa 06:00-14:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Neueröffnung Doppelstaatler NonEU+DE</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99913}}` |
| referenceId | `requestNeueroeffnungNonEU_DE` |

#### 5l. Request: Neueröffnung — Nicht-EU mit 2. Staatsangehörigkeit EU (nicht deutsch)

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
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Zeitschriftenladen` |
| STLGS_Potential__c | `3000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Sa 08:00-19:00</p>` |
| STLGS_Reason__c | `<p>Testbegründung Neueröffnung Doppelstaatler NonEU+EU</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99914}}` |
| referenceId | `requestNeueroeffnungNonEU_EU` |

#### 5m. Request: Vorgänger-Request am Predecessor Store (für Übernahme-Test)

Simuliert einen genehmigten Antrag am Vorgänger-Store (`b2bStorePredecessor`). Wird vom Snapshot-Flow `STLGS_CopyPreviousRPFileNumber` als Quelle für `FileNumberRPPrevious__c` am Übernahme-Request (5b) verwendet.

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_ReadOnlyRequest` |
| STLGS_Store__c | `{{Ref:b2bStorePredecessor}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Vertrag abgeschlossen` |
| STLGS_ApplicationDate__c | `2024-01-10` |
| STLGS_ContractStartPlanned__c | `2024-03-01` |
| STLGS_Industry__c | `Tabakgeschäft` |
| STLGS_Potential__c | `3500` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_FileNumberRP__c | `RP-2024-TEST-001` |
| STLGS_ApprovalDate__c | `2024-06-15` |
| STLGS_ReceiptDate__c | `2024-02-01` |
| STLGS_SetLeadingAt__c | `2024-06-15T10:00:00.000Z` |
| STLGS_AccountLead__c | `{{Ref:contactPredecessorLI}}` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `2024-01-10` |
| STLGS_DateIssueSchufa__c | `2024-01-10` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99901}}` |
| referenceId | `requestPredecessorNE` |

> **Hinweis:** 5m muss VOR 5b erstellt werden (Abhängigkeit: Vorgänger-Request muss existieren, damit der Snapshot-Flow ihn finden kann). In Apex-Scripts: `requestPredecessorNE` vor `requestUebernahmeNP` anlegen.
>
> **Post-Creation Update:** Nach Insert von 5m: `b2bStorePredecessor.STLGS_LeadingRequest__c = {{Ref:requestPredecessorNE}}` setzen. Der PredecessorStore braucht LeadingRequest damit die Testdaten produktionsnah sind.

#### 5m-ii. Request: Vorgänger-NE am selben Store für Verlegung

Simuliert einen genehmigten NE-Request am selben Store wie der Verlegungs-Request (5d/5f). Wird vom Snapshot-Flow `STLGS_CopyPreviousRPFileNumber` als Quelle für `FileNumberRPPrevious__c` am VL-Request verwendet. Unterschied zu 5m: lebt am selben Store (nicht am Predecessor Store).

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_ReadOnlyRequest` |
| STLGS_Store__c | `{{Ref:b2bStoreVollASt}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Vertrag abgeschlossen` |
| STLGS_ApplicationDate__c | `2024-01-10` |
| STLGS_ContractStartPlanned__c | `2024-03-01` |
| STLGS_Industry__c | `Tabakgeschäft` |
| STLGS_Potential__c | `5000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_FileNumberRP__c | `RP-2024-TEST-002` |
| STLGS_ApprovalDate__c | `2024-06-15` |
| STLGS_ReceiptDate__c | `2024-02-01` |
| STLGS_SetLeadingAt__c | `2024-06-15T10:00:00.000Z` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaber}}` |
| Name | `{{StoreNumber}}` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `2024-01-10` |
| STLGS_DateIssueSchufa__c | `2024-01-10` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| referenceId | `requestPredecessorNEForVL` |

> **Hinweis:** 5m-ii muss VOR 5d erstellt werden. Der VL-Request (5d) übernimmt dieselbe `Name`/StoreNumber.
>
> **Post-Creation Update:** Nach Insert von 5m-ii: `b2bStoreVollASt.STLGS_LeadingRequest__c = {{Ref:requestPredecessorNEForVL}}` setzen. Nur bei Verlegung-Presets nötig (Store hat dann einen abgeschlossenen NE als "Leading").

#### 5n-prereq. Request: Vorgänger-NE am Predecessor Store OHNE AZ (für Negativ-Test 5n)

Simuliert einen genehmigten NE-Request am Predecessor Store ohne Aktenzeichen (`b2bStorePredecessorNoAZ`). Analog zu 5m, aber **ohne** `STLGS_FileNumberRP__c`. Wird vom Snapshot-Flow als Quelle gesucht — da kein AZ vorhanden, bleibt `FileNumberRPPrevious__c` am ÜN-Request null.

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_ReadOnlyRequest` |
| STLGS_Store__c | `{{Ref:b2bStorePredecessorNoAZ}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Vertrag abgeschlossen` |
| STLGS_ApplicationDate__c | `2024-01-10` |
| STLGS_ContractStartPlanned__c | `2024-03-01` |
| STLGS_Industry__c | `Tabakgeschäft` |
| STLGS_Potential__c | `3500` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_ApprovalDate__c | `2024-06-15` |
| STLGS_ReceiptDate__c | `2024-02-01` |
| STLGS_SetLeadingAt__c | `2024-06-15T10:00:00.000Z` |
| STLGS_AccountLead__c | `{{Ref:contactPredecessorNoAZLI}}` |
| Name | `{{StoreNumber:X99905}}` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `2024-01-10` |
| STLGS_DateIssueSchufa__c | `2024-01-10` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| referenceId | `requestPredecessorNENoAZ` |

> **Hinweis:** 5n-prereq muss VOR 5n erstellt werden. Kein `STLGS_FileNumberRP__c` — das ist der Testpunkt.
>
> **Post-Creation Update:** Nach Insert von 5n-prereq: `b2bStorePredecessorNoAZ.STLGS_LeadingRequest__c = {{Ref:requestPredecessorNENoAZ}}` setzen.

#### 5n. Request: ÜN ohne Vorgänger-AZ (Negativ-Test FileNumberRP)

Simuliert eine Übernahme wo der Vorgänger-Request KEIN Aktenzeichen RP hat. Der Snapshot-Flow `STLGS_CopyPreviousRPFileNumber` soll `FileNumberRPPrevious__c` **nicht** befüllen.

Benötigt eigenen Predecessor Store + Predecessor Request ohne FileNumberRP. Verwendet denselben Contact wie 5b (`contactLizenzinhaber`).

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
| STLGS_ContractStartPlanned__c | `{{Today+35d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Kiosk` |
| STLGS_Potential__c | `2500` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_PredecessorStore__c | `{{Ref:b2bStorePredecessorNoAZ}}` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 08:00-20:00</p>` |
| STLGS_Reason__c | `<p>Negativ-Test: ÜN ohne Vorgänger-AZ</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99907}}` |
| referenceId | `requestUebernahmeNoAZ` |

> **Abhängigkeit:** Sek. 2g (`b2bStorePredecessorNoAZ`), 5n-prereq (`requestPredecessorNENoAZ`), Sek. 3b (`contactLizenzinhaber`)
> **Erwartet nach Freigabe:** `FileNumberRPPrevious__c = null` (kein AZ am Vorgänger → nichts zu kopieren).

#### 5o. Request: VL als einziger Request am Store (Negativ-Test FileNumberRP)

Simuliert eine Verlegung an einem Store der nur diesen einen Request hat (keinen Vorgänger-NE-Request). Der Snapshot-Flow `STLGS_CopyPreviousRPFileNumber` sucht via `Store = $Record.Store AND Id != $Record.Id` und findet nichts → `FileNumberRPPrevious__c` bleibt null.

Benötigt eigenen Store ohne vorherige Requests. Verwendet eigenen Contact.

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bStoreAloneVL}}` |
| STLGS_Type__c | `Verlegung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactAloneVL}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_TransferDate__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Schreibwaren` |
| STLGS_Potential__c | `3000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_AverageTurnoverPredecessor__c | `3000` |
| STLGS_Street__c | `Neue Teststraße 1` |
| STLGS_Postalcode__c | `70173` |
| STLGS_City__c | `Stuttgart` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 09:00-18:00</p>` |
| STLGS_Reason__c | `<p>Negativ-Test: VL ohne Vorgänger-Request</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| Name | `{{StoreNumber:X99906}}` |
| referenceId | `requestVerlegungAlone` |

> **Abhängigkeit:** Sek. 2h (`b2bStoreAloneVL`, Status "Betriebsbereit"), Sek. 3h (`contactAloneVL`), ACR 4h. Der Store darf KEINEN anderen Request haben.
> **Erwartet nach Freigabe:** `FileNumberRPPrevious__c = null` (kein anderer Request am Store → nichts zu kopieren).
> **Hinweis:** Store muss auf "Betriebsbereit" stehen damit eine Verlegung fachlich Sinn macht (siehe `verlegung-np.apex` Zeile 172-177).

#### 5q. Request: Neueröffnung NP — OHNE Gewerbeanmeldung (Nachreich-Test CRM-2882)

Kopie von 5a, aber `STLGS_HasBusinessRegistration__c = false` und Store ohne IBAN (`b2bPotentialStoreNoBankdata`). Testet nach Implementierung von CRM-2882 die automatische Erstellung eines Vorgangs "Änderung vertragsrelevanter Daten" mit Anliegen-Typ "Gewerbeanmeldung nachreichen". Da der Store auch keine IBAN hat, testet dieser Request gleichzeitig CRM-3057 (Bankdaten-Nachreichung mit Duplikat-Schutz).

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bPotentialStoreNoBankdata}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaber}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Tabakgeschäft` |
| STLGS_Potential__c | `5000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 08:00-20:00, Sa 08:00-18:00</p>` |
| STLGS_Reason__c | `<p>Nachreich-Test: Neueröffnung ohne Gewerbeanmeldung</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `false` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| STLGS_FileNumberRP__c | `RP-2024-TEST-NOGEWERBE` |
| STLGS_SetLeadingAt__c | `2024-01-15T10:00:00.000Z` |
| Name | `{{StoreNumber:X99903}}` |
| referenceId | `requestNEOhneGewerbeanmeldung` |

> **Abhängigkeit:** Sek. 2f (`b2bPotentialStoreNoBankdata`), Sek. 3b (`contactLizenzinhaber`)
> **Unterschied zu 5a:** `STLGS_HasBusinessRegistration__c = false`, Store ohne IBAN
> **Testplan:** Status → "An Zentrale übergeben" → Gewerbeanmeldung-Case + Bankdaten-Case werden automatisch erstellt

#### 5r. Request: Neueröffnung NP — MIT Gewerbeanmeldung, OHNE IBAN (Nachreich-Test CRM-3057)

Kopie von 5a, aber Store ohne IBAN (`b2bPotentialStoreNoBankdata`). `STLGS_HasBusinessRegistration__c = true` (Gewerbeanmeldung vorhanden). Testet isoliert CRM-3057 (Bankdaten-Nachreichung) — nur der Bankdaten-Case wird erstellt, kein Gewerbeanmeldung-Case.

| Field | Value |
|-------|-------|
| sObject | `STLGS_Request__c` |
| RecordType | `STLGS_StandardRequest` |
| STLGS_Store__c | `{{Ref:b2bPotentialStoreNoBankdata}}` |
| STLGS_Type__c | `Neueröffnung` |
| STLGS_SalesType__c | `Vollannahmestelle` |
| STLGS_Status__c | `Zusammenarbeit prüfen` |
| STLGS_AccountLead__c | `{{Ref:contactLizenzinhaber}}` |
| STLGS_ApplicationDate__c | `{{Today}}` |
| STLGS_ContractStartPlanned__c | `{{Today+49d}}` |
| STLGS_PlayerProtectionTraining__c | `{{Today}}` |
| STLGS_ProductTerminalTraining__c | `{{Today}}` |
| STLGS_Industry__c | `Tabakgeschäft` |
| STLGS_Potential__c | `5000` |
| STLGS_IsStandardTaxation__c | `true` |
| STLGS_IsSmallBusinessOwner__c | `false` |
| STLGS_InitialTerminalHours__c | `<p>Mo-Fr 08:00-20:00, Sa 08:00-18:00</p>` |
| STLGS_Reason__c | `<p>Nachreich-Test: Neueröffnung mit Gewerbeanmeldung, ohne IBAN</p>` |
| STLGS_HasRequest__c | `true` |
| STLGS_HasAdditionPermission__c | `true` |
| STLGS_DidHandoverDataProtectionASt__c | `true` |
| STLGS_HasCriminalRecord__c | `true` |
| STLGS_HasBusinessRegistration__c | `true` |
| STLGS_HasSEPAMandate__c | `true` |
| STLGS_HasCriminalRecordBusinessAccount__c | `true` |
| STLGS_HasSchufa__c | `true` |
| STLGS_IssueDateCriminalRecord__c | `{{Today}}` |
| STLGS_IssueDateCriminalRecordBA__c | `{{Today}}` |
| STLGS_DateIssueSchufa__c | `{{Today}}` |
| STLGS_HasFurtherExplanation__c | `true` |
| STLGS_HasSitePlan__c | `true` |
| STLGS_IloProfit__c | `true` |
| STLGS_HasKnowledgeTransfer__c | `true` |
| STLGS_FileNumberRP__c | `RP-2024-TEST-NOIBAN` |
| STLGS_SetLeadingAt__c | `2024-01-15T10:00:00.000Z` |
| Name | `{{StoreNumber:X99904}}` |
| referenceId | `requestNEOhneIBAN` |

> **Abhängigkeit:** Sek. 2f (`b2bPotentialStoreNoBankdata`), Sek. 3b (`contactLizenzinhaber`)
> **Unterschied zu 5a:** Store ohne IBAN, `HasBusinessRegistration__c = true`
> **Testplan:** Status → "An Zentrale übergeben" → nur Bankdaten-Case wird erstellt (kein Gewerbeanmeldung-Case)

---

### 6. B2C Cases

> **Sektion 6** | Tags: `b2c`, `case` | Abhängigkeiten: Sek. 1 | Records: 3 | Beschreibung: B2C Cases (Allgemeines Anliegen, Gewinnauskunft, Erwin-Plattform)

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

Alle 7x-Sub-Sektionen erfordern Sek. 0 + 2 (und Sek. 3 für ContactId). Sub-Sektionen sind unabhängig voneinander wählbar.

> **Sektion 7a** | Tags: `b2b`, `case`, `service-desk` | Abhängigkeiten: Sek. 0, 2 | Records: 1 | Beschreibung: Service Desk allgemeine Anfrage (B2B)

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

> **Sektion 7b–7c** | Tags: `b2b`, `case`, `vde`, `asset` | Abhängigkeiten: Sek. 0, 2 | Records: 2 | Beschreibung: VDE Prüfung (Vollannahmestelle + Lotto Kompakt — Flow erstellt Assets automatisch)

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

> **Sektion 7d** | Tags: `b2b`, `case`, `testkauf`, `compliance` | Abhängigkeiten: Sek. 0, 2 | Records: 1 | Beschreibung: Testkauf (Mystery-Shopping, Ampelsystem Jugendschutz)

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

> **Sektion 7e–7f** | Tags: `b2b`, `case`, `pflichtschulung` | Abhängigkeiten: Sek. 0, 2 | Records: 2 | Beschreibung: Pflichtschulung Jugend- und Spielerschutz (Präsenz + Online/E-Learning)

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

> **Sektion 7g–7p** | Tags: `b2b`, `case`, `verwaltung` | Abhängigkeiten: Sek. 0, 2 | Records: 10 | Beschreibung: Verwaltungs-Cases (Kündigung, Vertragsänderung, Bankdaten, Rücklastschrift, Kontrollbesuch, Terminallaufzeiten, Bestellung, Wartung, FV-Wechsel)

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

> **Sektion 8** | Tags: `b2b`, `besuch`, `visit` | Abhängigkeiten: Sek. 0, 2 | Records: 1 | Beschreibung: Besuchsbericht Regelbesuch (eigenes Objekt STLGS_VisitReport__c)

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

> **Sektion 9** | Tags: `b2b`, `asset`, `vde` | Abhängigkeiten: Sek. 0, 2, 7b | Records: 2 | Beschreibung: Manuelle Test-Assets (Terminal & Drucker, Lottowand) — unabhängig vom VDE-Flow, für Inspektion-Workflow-Tests

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

### 10. Flow-Negativ-Tests (FileNumberRP Snapshot)

> **Sektion 10** | Tags: `b2b`, `flow-test`, `filenumber` | Abhängigkeiten: Sek. 0 | Records: ~12 | Beschreibung: Negativ-Szenarien für den Snapshot-Flow `STLGS_CopyPreviousRPFileNumber` (CRM-2977). Erzeugt eigene Stores/Contacts — unabhängig von den Haupt-Testdaten.

Diese Tests validieren die korrekte Funktionsweise des Snapshot-Flows, der beim Status-Übergang auf "An Zentrale übergeben" das `FileNumberRPPrevious__c` vom neuesten anderen Request am selben Store kopiert. Die Testdaten werden erzeugt und dann manuell in der UI durch den Status-Lifecycle geführt (ZP → AV → FRD → AZÜ).

**Script:** `scripts/apex/testdata/flow-test-filenumber-setup.apex`

#### 10a. T3: VL wo Vorgänger KEIN AZ hat

Erwartet: `FileNumberRPPrevious__c` bleibt `null` nach "An Zentrale übergeben".

- **Store:** Eigener Store (T3), natürliche Person, Betriebsbereit
- **Vorgänger-Request:** NE, ReadOnly, "Vertrag abgeschlossen", **OHNE** `FileNumberRP__c`
- **Contact + ACR:** Eigener Lizenzinhaber
- **Test-Request:** VL, StandardRequest, "Zusammenarbeit prüfen"
- **StoreNumber:** `{{StoreNumber:X99905}}`
- **Name (Requests):** `{{StoreNumber:X99905}}`

#### 10b. T4: VL mit mehreren Requests am Store

Erwartet: `FileNumberRPPrevious__c` = `RP-T4-NEU` (neuester anderer Request, nicht der älteste).

- **Store:** Eigener Store (T4), natürliche Person, Betriebsbereit
- **Vorgänger 1:** NE, ReadOnly, "Vertrag abgeschlossen", `FileNumberRP__c = 'RP-T4-ALT'` (2023)
- **Vorgänger 2:** VL1, ReadOnly, "Vertrag abgeschlossen", `FileNumberRP__c = 'RP-T4-NEU'` (2024)
- **Contact + ACR:** Eigener Lizenzinhaber
- **Test-Request:** VL2, StandardRequest, "Zusammenarbeit prüfen"
- **StoreNumber:** `{{StoreNumber:X99906}}`
- **Name (Requests):** `{{StoreNumber:X99906}}`

#### 10c. T5: NE — kein Snapshot (Decision-Default-Pfad)

Erwartet: `FileNumberRPPrevious__c` bleibt `null` (Flow-Decision erkennt Typ ≠ Verlegung).

- **Store:** Mitnutzung T3-Store
- **Test-Request:** NE, StandardRequest, "Zusammenarbeit prüfen"
- **Name:** `{{StoreNumber:X99905}}`

#### 10d. T6: VL — Status nicht "An Zentrale übergeben"

Erwartet: Kein Snapshot (Flow feuert nur bei Status = "An Zentrale übergeben").

- **Store:** Mitnutzung T3-Store
- **Test-Request:** VL, StandardRequest, "Zusammenarbeit prüfen" → User führt nur bis "Genehmigt durch RP"
- **Name:** `{{StoreNumber:X99905}}`

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
- **Store-Pflichtfelder**: `STLGS_StoreTerm__c` (Bezeichnung der ASt, Text), `STLGS_District__c` (Gemeinde, Lookup auf `STLGS_District__c`) und `STLGS_Email__c` (E-Mail) müssen bei ALLEN Store-Accounts mit RecordType `STLGS_Store` (2c, 2d, 2e) gesetzt werden. District wird per Lookup in Sektion 0b ermittelt. **Ohne `STLGS_District__c` kann ein Account nicht als `STLGS_Store` gespeichert werden** — er bleibt dann als `STLGS_PotentialStore`.
- **PotentialStore vs Store RecordType**: Für Test-Szenarien, die nur einen funktionierenden Store als Parent für Requests benötigen (z.B. CRM-3053 Backfill), ist `STLGS_PotentialStore` mit `STLGS_StoreStatus__c = 'Betriebsbereit'` die korrekte Wahl — es entfällt die Pflicht für `STLGS_District__c`. `STLGS_Store` (2c, 2d, 2e) ist nur nötig, wenn der Test die Store-spezifischen Pflichtfelder oder Validierungsregeln tatsächlich prüft.
- **Besteuerung**: `STLGS_IsStandardTaxation__c` (Regelbesteuerung) und `STLGS_IsSmallBusinessOwner__c` (Kleinunternehmer) sind Gegenstücke — wenn eines `true` ist, muss das andere `false` sein. Hat nichts mit Nationalität zu tun.
- **Request-Pflichtfelder für Tests**: `STLGS_PlayerProtectionTraining__c`, `STLGS_ProductTerminalTraining__c` (Schulungsdaten), `STLGS_Industry__c` (Branche), `STLGS_Potential__c` (Umsatzprognose), `STLGS_InitialTerminalHours__c` (Terminallaufzeiten), `STLGS_Reason__c` (Begründung) — alle bei Requests (5a-5h) setzen.
- **Contact-Pflichtfelder**: `Salutation` (Herr/Frau) muss bei allen Sales Contacts gesetzt werden.
- **Verlegung-Pflichtfelder**: `STLGS_Street__c` (neue Straße), `STLGS_Postalcode__c` (neue PLZ), `STLGS_City__c` (neuer Ort) und `STLGS_TransferDate__c` (Verlegungsdatum, mind. 6 Wochen in der Zukunft) — nur bei Requests mit `STLGS_Type__c = Verlegung` (5d).
- **Validierungsbereit (Prüfen/Freigabe):** Alle Requests (5a-5h) enthalten die Dokument-/Compliance-Checkboxen aus `STLGS_DisplayMandatoryRequestFields`. Bei Bedarf Checkboxen auf `false` setzen um Validierungsfehler zu testen.
- **Bankdaten am Store**: `STLGS_IBAN__c`, `STLGS_BIC__c`, `STLGS_Bankname__c`, `STLGS_BankAccountType__c`, `STLGS_LastCompanyName__c` (Kontoinhaber), `STLGS_Street__c`, `STLGS_Postalcode__c`, `STLGS_City__c` (Kontoinhaber-Adresse) — geprüft in `STLGS_IsBankdataVisible`. Auf allen Stores (2b-2e) gesetzt. **Hinweis:** Bankdaten werden in der Validierung als Pflicht angezeigt, der Regionaldirektor kann den Antrag aber auch ohne Bankdaten freigeben — er erhält dann den Hinweis, dass die Bankdaten spätestens 4 Wochen nach Freigabe nachgereicht werden müssen. Ein Antrag ohne Bankdaten ist daher ein valides Testszenario.
- **Vorgänger-ASt (Übernahme)**: Store 2e mit `STLGS_TerminatedOn__c` — ohne Kündigungsdatum blockiert VR `STLGS_TerminatedOnEmpty` die Freigabe bei Übernahme-Anträgen (5b).
- **CRM-3011 Wissensweitergabe**: `STLGS_HasKnowledgeTransfer__c = true` — VR `STLGS_ValidateKnowledgeTransfer` blockiert "An Zentrale übergeben" wenn false.
- **Dokument-Gültigkeit**: `STLGS_IssueDateCriminalRecord__c` und `STLGS_DateIssueSchufa__c` dürfen max. 182 Tage vor `ContractStartPlanned__c` (bzw. `TransferDate__c` bei Verlegung) liegen. Testdaten setzen `{{Today}}` → immer gültig.
- **ILO Profit**: `STLGS_IloProfit__c = true` für Vorort-Gespräch-Validierung (`STLGS_IsOnsiteDiscussionVisible`). Wenn `STLGS_IsOperatedByAgency__c = true`, ist zusätzlich `STLGS_ECCard__c = true` nötig.
- **Verlegung AverageTurnoverPredecessor**: `STLGS_AverageTurnoverPredecessor__c` nur bei Verlegung (5d) Pflicht (Formel `STLGS_VerlegungMandatoryFields`). Bei Übernahme wird der Wert bei Freigabe automatisch aus `PredecessorStore.STLGS_AverageRevenueLast6Months__c` übernommen.
- **Business-Request Zusatz-Dokumente**: Jur. Person (5c) braucht zusätzlich: `STLGS_HasSEPAMandate__c`, `STLGS_HasCriminalRecordBusinessAccount__c`, `STLGS_IssueDateCriminalRecordBA__c`, `STLGS_HasCommercialRegisterExtract__c`. Standard-Requests brauchen stattdessen `STLGS_HasSchufa__c` + `STLGS_DateIssueSchufa__c`.
- **Nachreichbare Dokumente**: Bankdaten und Gewerbeanmeldung (`STLGS_HasBusinessRegistration__c`) werden in der Validierung als Pflicht angezeigt, der RD kann den Antrag aber auch ohne diese freigeben. Bankdaten müssen spätestens 4 Wochen nach Freigabe, Gewerbeanmeldung spätestens 4 Wochen nach Eröffnung nachgereicht werden. Anträge ohne diese Felder sind daher valide Testszenarien für den Nachreich-Prozess.
- **RecordType-Switch bei Status-Lifecycle:** Status-Werte sind per RecordType restricted. `STLGS_StandardRequest` / `STLGS_BusinessRequest` erlauben Status bis "Genehmigt durch RP". Ab "An Zentrale übergeben" muss der RT auf `STLGS_ReadOnlyRequest` (NP) bzw. `STLGS_ReadOnlyBusinessRequest` (JP) gewechselt werden. RT und Status müssen **in derselben DML-Operation** gesetzt werden — separate Updates schlagen fehl weil der alte RT den neuen Status nicht erlaubt und umgekehrt. Vorgänger-Requests (5m, 5m-ii, 5n-prereq) werden direkt mit ReadOnlyRT + "Vertrag abgeschlossen" insertiert — dort ist kein RT-Switch nötig.
- **Store-RecordType-Fix nach Request-Insert:** Der Flow `STLGS_UpdateAccStatusOnCreateUpdateRequest` ändert beim Insert eines Requests den Store-RT auf `STLGS_PotentialStore`. Bei Stores die bereits "Betriebsbereit" sein müssen (Verlegung, Übernahme-PredecessorStore, Flow-Test-Stores), muss der Store NACH dem Request-Insert explizit zurückgesetzt werden: RecordType → `STLGS_Store`, `STLGS_StoreStatus__c` → `Betriebsbereit`. In Apex-Scripts geschieht das als separater `update`-Aufruf nach dem Request-Insert.
- **Produktionsnahe Vorgänger-Requests:** Jeder Predecessor-Request (ReadOnly, "Vertrag abgeschlossen") braucht: (1) `STLGS_AccountLead__c` → Contact am selben Store (= alter Lizenzinhaber), (2) `STLGS_SetLeadingAt__c` → DateTime wann der Request "Leading" wurde, (3) `STLGS_FileNumberRP__c` → Aktenzeichen RP (außer bei Negativ-Tests). Der zugehörige Store braucht `STLGS_LeadingRequest__c` → Lookup auf den neuesten abgeschlossenen Request. Ohne diese Felder sind die Testdaten nicht produktionsnah und Flows/Trigger die auf Leading-Requests prüfen können fehlschlagen.

## Process Coverage Matrix

| Business Process | Covered By | Record Type | Key Differentiator |
| --- | --- | --- | --- |
| Neueröffnung (nat. Person) | 5a | `STLGS_StandardRequest` | `STLGS_Type__c = Neueröffnung` |
| Übernahme (nat. Person) | 5b | `STLGS_StandardRequest` | `STLGS_Type__c = Übernahme` |
| Neueröffnung (jur. Person) | 5c | `STLGS_BusinessRequest` | `STLGS_Type__c = Neueröffnung` |
| Verlegung (nat. Person) | 5d | `STLGS_StandardRequest` | `STLGS_Type__c = Verlegung` |
| Übernahme (jur. Person) | 5e | `STLGS_BusinessRequest` | `STLGS_Type__c = Übernahme` |
| Verlegung (jur. Person) | 5f | `STLGS_BusinessRequest` | `STLGS_Type__c = Verlegung` |
| Agenturstandort (nat. Person) | 5g | `STLGS_StandardRequest` | `STLGS_IsOperatedByAgency__c = true` |
| Agenturstandort (jur. Person) | 5h | `STLGS_BusinessRequest` | `STLGS_IsOperatedByAgency__c = true` |
| Neueröffnung (EU-Ausländer) | 5i | `STLGS_StandardRequest` | EU-Führungszeugnis-Pflicht |
| Neueröffnung (Nicht-EU) | 5j | `STLGS_StandardRequest` | Aufenthalts-/Gewerbeerlaubnis |
| Neueröffnung (NonEU + DE) | 5k | `STLGS_StandardRequest` | Doppelstaatler, keine Sonderunterlagen |
| Neueröffnung (NonEU + EU) | 5l | `STLGS_StandardRequest` | Doppelstaatler, EU-FZ Pflicht |
| Vorgänger-Request (Übernahme) | 5m | `STLGS_StandardRequest` | FileNumberRP + Status "Vertrag abgeschlossen" am Predecessor Store |
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
| Flow-Test: VL ohne AZ | 10a (T3) | `STLGS_StandardRequest` | Vorgänger ohne FileNumberRP |
| Flow-Test: VL mehrere Requests | 10b (T4) | `STLGS_StandardRequest` | Neuester anderer Request = AZprev |
| Flow-Test: NE kein Snapshot | 10c (T5) | `STLGS_StandardRequest` | Decision-Default (Typ ≠ Verlegung) |
| Flow-Test: VL falscher Status | 10d (T6) | `STLGS_StandardRequest` | Kein Snapshot ohne "An Zentrale" |

## Presets

Vordefinierte Record-Sets für häufige Testszenarien. Jedes Preset listet exakt die Sub-Records die angelegt werden. Der Skill `/create-testdata` überspringt die interaktive Auswahl.

### neueroeffnung-np

> **Records:** 0a, 0b-i, 0b-ii, 2c, 3b, 4a, 5a | **~6 Records**
>
> **Szenario:** Standard-Neueröffnung natürliche Person (Vollannahmestelle, deutscher Lizenzinhaber). Deckt den häufigsten Antragstyp ab.
>
> **Testablauf:**
> 1. Request öffnen — Status "Zusammenarbeit prüfen"
> 2. "Antrag vorbereiten" — "Genehmigt durch RP" (Checkliste: alle Pflichtfelder grün)
> 3. "Freigeben" klicken — Validierungs-Flow prüft alle Sektionen
> 4. "An Zentrale übergeben" — RT wechselt zu ReadOnly
>
> **Erwartetes Ergebnis:** Antrag durchläuft kompletten Lifecycle ohne Validierungsfehler. Nach "An Zentrale übergeben": RT = ReadOnly, Status = "An Zentrale übergeben".

### neueroeffnung-jp

> **Records:** 0a, 0b-i, 0b-ii, 0b-iii, 2a, 2d, 3a, 3c, 4b, 4c, 5c | **~9 Records**
>
> **Szenario:** Neueröffnung juristische Person (Lotto Kompakt, GmbH). Prüft Business-Request-Pfad mit Geschäftsführer + Filialverantwortliche.
>
> **Testablauf:**
> 1. Request öffnen — Geschäftsführer + Filialverantwortliche verknüpft
> 2. Lifecycle wie NE-NP, aber zusätzliche JP-Validierung (Handelsregisterauszug, GF-Führungszeugnis)
>
> **Erwartetes Ergebnis:** JP-Pfad im Validierungs-Flow korrekt. Alle JP-spezifischen Sektionen (Business Account, Geschäftsführer) geprüft.

### uebernahme-np

> **Records:** 0a, 0b-i, 0b-ii, 2c, 2e, 3b, 3-pred, 4a, 4-pred, 5m, 5b | **~10 Records**
>
> **Szenario:** Standard-Übernahme mit Vorgänger-ASt + Vorgänger-Request mit AZ RP. Prüft Snapshot-Flow (`FileNumberRPPrevious`).
>
> **Testablauf:**
> 1. ÜN-Request öffnen — PredecessorStore verknüpft, Vorgänger-Request (5m) existiert mit AZ
> 2. Lifecycle bis "An Zentrale übergeben"
> 3. Snapshot-Flow feuert — `FileNumberRPPrevious__c` wird vom Vorgänger kopiert
>
> **Erwartetes Ergebnis:** `FileNumberRPPrevious__c` = `RP-2024-TEST-001` (Wert vom Vorgänger 5m). PredecessorStore hat LeadingRequest. Predecessor-Request hat AccountLead.

### uebernahme-jp

> **Records:** 0a, 0b-i, 0b-ii, 0b-iii, 2a, 2d, 2e, 3a, 3c, 3-pred, 4b, 4c, 4-pred, 5m, 5e | **~13 Records**
>
> **Szenario:** Übernahme juristische Person mit Vorgänger-ASt + Vorgänger-Request. Prüft JP-Pfad + Predecessor-Logik.
>
> **Testablauf:** Analog uebernahme-np, aber JP-Validierungs-Pfad (Business Account, GF, FV).
>
> **Erwartetes Ergebnis:** JP-Lifecycle + Snapshot wie bei ÜN-NP. PredecessorStore hat LeadingRequest + Contact mit AccountLead.

### verlegung-np

> **Records:** 0a, 0b-i, 0b-ii, 2c, 3b, 4a, 5m-ii, 5d | **~7 Records**
>
> **Szenario:** Verlegung natürliche Person. Store ist bereits "Betriebsbereit" (aktive ASt zieht um). Prüft VL-Pflichtfelder + Snapshot-Flow.
>
> **Testablauf:**
> 1. VL-Request öffnen — neue Adresse + Verlegungsdatum gesetzt
> 2. Lifecycle bis "An Zentrale übergeben"
> 3. Snapshot-Flow: `FileNumberRPPrevious__c` vom Vorgänger-NE (5m-ii) kopiert
>
> **Erwartetes Ergebnis:** `FileNumberRPPrevious__c` = `RP-2024-TEST-002`. Store nach Erstellung: RT = STLGS_Store, Status = Betriebsbereit.
>
> **Hinweis:** Store wird am Ende auf `STLGS_Store` (RT) + `Betriebsbereit` (Status) zurückgesetzt — Flows ändern RT nach Request-Insert auf PotentialStore. LeadingRequest am Store = 5m-ii.

### verlegung-jp

> **Records:** 0a, 0b-i, 0b-ii, 0b-iii, 2a, 2d, 3a, 3c, 4b, 4c, 5f | **~9 Records**
>
> **Szenario:** Verlegung juristische Person. Analog VL-NP, aber JP-Pfad (Business Account, GF, FV).
>
> **Testablauf:** Wie VL-NP, aber JP-Validierung. Store-Status-Fix nach Request-Insert nötig.
>
> **Erwartetes Ergebnis:** JP-Lifecycle + Store auf Betriebsbereit nach Erstellung.

### agentur-np

> **Records:** 0a, 0b-i, 0b-ii, 2c, 3b, 4a, 5g | **~6 Records**
>
> **Szenario:** Agenturstandort natürliche Person. Prüft `IsOperatedByAgency` + `ECCard` Validierung (Vorort-Gespräch-Sektion).
>
> **Testablauf:**
> 1. Request öffnen — `IsOperatedByAgency = true`, `ECCard = true`
> 2. Lifecycle bis Freigabe — Vorort-Gespräch-Sektion muss IloProfit + ECCard prüfen
>
> **Erwartetes Ergebnis:** Validierungs-Flow zeigt "Vorort-Gespräch"-Sektion mit IloProfit + ECCard-Prüfung (ECCard nur bei Agenturbetrieb sichtbar).

### b2b-komplett

> **Records:** alle aus Sek. 0, 2, 3, 4, 5, 7a-7p, 8, 9 | **~60+ Records** | Vollständiger B2B-Datensatz — Anträge + Cases + Besuchsberichte + Assets

### b2c-komplett

> **Records:** alle aus Sek. 0, 1, 6 | **~6 Records** | Vollständiger B2C-Datensatz — Person Accounts + B2C Cases

### alles

> **Records:** alle | **~70+ Records** | Kompletter Datensatz (B2B + B2C)
