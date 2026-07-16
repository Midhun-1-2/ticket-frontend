import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Country, State } from 'country-state-city'
import { isValidPhoneNumber, isSupportedCountry, getCountryCallingCode, getExampleNumber } from 'libphonenumber-js'
import examplesMobile from 'libphonenumber-js/examples.mobile.json'
import { postcodeValidator, postcodeValidatorExistsForCountry } from 'postcode-validator'
import '/src/style.css'
import '/src/onboarding.css'
import api from '/src/api.js'
import SearchableSelect from '/src/SearchableSelect.jsx'

const STEP_LABELS = ['Company & Contact Details', 'Product Details', 'Review & Submit']

// Step 1 sub-sections, navigated via the sidebar or Continue/Back buttons.
const SECTION_META = [
  { key: 'company', label: 'Company Info', heading: 'Company Information', subtitle: 'Tell us about your organisation.' },
  { key: 'address', label: 'Address', heading: 'Address Details', subtitle: 'Where is your company registered or based?' },
  { key: 'contact', label: 'Primary Contact', heading: 'Primary Contact Details', subtitle: 'This person is the main point of contact and login owner.' },
  { key: 'additional', label: 'Support & Products', heading: 'Additional Information', subtitle: 'Support preferences and the products or services you use.' },
]

// Which formData fields "belong" to each Step 1 sub-section — used to flag
// a sidebar sub-step with an error dot, and to scope validation.
const SECTION_FIELDS = [
  ['companyName', 'companyType', 'gstNumber'],
  ['addressLine1', 'city', 'state', 'country', 'pincode'],
  ['contactName', 'email', 'mobileNumber', 'phoneNumber', 'password', 'confirmPassword'],
  ['amcStatus', 'amcStartDate', 'amcEndDate', 'productsInUse'],
]

const SECTION_REQUIRED = [
  { companyName: 'Company name is required', companyType: 'Company type is required', gstNumber: 'GST number is required' },
  { addressLine1: 'Address line 1 is required', city: 'City is required', state: 'State is required', country: 'Country is required', pincode: 'Pincode is required' },
  { contactName: 'Contact person name is required', email: 'Email is required', mobileNumber: 'Mobile number is required', password: 'Password is required', confirmPassword: 'Please confirm your password' },
  {},
]

const emptyProduct = () => ({
  productName: '',
  productVersion: '',
  activationDate: '',
  supportType: 'AMC',
})

const initialFormData = {
  // Section A - Company Information
  companyName: '',
  companyCode: '',
  companyType: '',
  gstNumber: '',
  panNumber: '',
  website: '',
  industryType: '',
  annualTurnover: '',
  employeeCount: '',
  // Section B - Address Details
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  // Section C - Primary Contact Details
  contactName: '',
  designation: '',
  email: '',
  mobileNumber: '',
  phoneNumber: '',
  alternateEmail: '',
  password: '',
  confirmPassword: '',
  // Section D - Additional Information
  amcStatus: '',
  amcStartDate: '',
  amcEndDate: '',
  preferredChannel: '',
  preferredTime: '',
  productsInUse: [],
  contractRefNumber: '',
}

// Per-country max length and example format for the Pincode field.
const POSTAL_CODE_META = {
  IN: { maxLength: 6, example: '682016' },
  US: { maxLength: 10, example: '90210 or 90210-1234' },
  CA: { maxLength: 7, example: 'A1A 1A1' },
  GB: { maxLength: 8, example: 'SW1A 1AA' },
  AU: { maxLength: 4, example: '2000' },
  DE: { maxLength: 5, example: '10115' },
  FR: { maxLength: 6, example: '75001' },
  IT: { maxLength: 5, example: '00100' },
  CH: { maxLength: 4, example: '8001' },
  AT: { maxLength: 4, example: '1010' },
  ES: { maxLength: 5, example: '28001' },
  NL: { maxLength: 7, example: '1012 AB' },
  BE: { maxLength: 4, example: '1000' },
  DK: { maxLength: 4, example: '1050' },
  SE: { maxLength: 6, example: '111 22' },
  NO: { maxLength: 4, example: '0150' },
  BR: { maxLength: 9, example: '01310-100' },
  PT: { maxLength: 8, example: '1000-001' },
  IE: { maxLength: 8, example: 'D02 AF30' },
  SG: { maxLength: 6, example: '049483' },
  CN: { maxLength: 6, example: '100000' },
  JP: { maxLength: 8, example: '100-0001' },
}
const DEFAULT_POSTAL_META = { maxLength: 10, example: null }

// Strips non-digit characters and caps length — used for phone-style inputs.
const digitsOnly = (value, maxLen) => value.replace(/\D/g, '').slice(0, maxLen)

// Case- and whitespace-insensitive key used to group products by name.
function normalizeName(name) {
  return (name || '').replace(/\s+/g, '').toLowerCase()
}

// Standard 15-character Indian GSTIN pattern, enforced only when country is India.
const GSTIN_PATTERN = /^\d{2}[A-Za-z]{5}\d{4}[A-Za-z]{1}[1-9A-Za-z]{1}Z[0-9A-Za-z]{1}$/

// ---------- camelCase (frontend) <-> snake_case (backend) mapping ----------

function toBackendPayload(formData, products) {
  return {
    company_name: formData.companyName,
    company_code: formData.companyCode,
    company_type: formData.companyType,
    gst_number: formData.gstNumber,
    pan_number: formData.panNumber,
    website: formData.website,
    industry_type: formData.industryType,
    annual_turnover: formData.annualTurnover,
    employee_count: formData.employeeCount,
    address_line1: formData.addressLine1,
    address_line2: formData.addressLine2,
    city: formData.city,
    state: formData.state,
    country: formData.country,
    pincode: formData.pincode,
    contact_name: formData.contactName,
    designation: formData.designation,
    email: formData.email,
    mobile_number: formData.mobileNumber,
    phone_number: formData.phoneNumber,
    alternate_email: formData.alternateEmail,
    password: formData.password,
    confirm_password: formData.confirmPassword,
    amc_status: formData.amcStatus,
    amc_start_date: formData.amcStartDate || null,
    amc_end_date: formData.amcEndDate || null,
    preferred_channel: formData.preferredChannel,
    preferred_time: formData.preferredTime,
    products_in_use: formData.productsInUse,
    contract_ref_number: formData.contractRefNumber,
    products: products.map((p) => ({
      product_name: p.productName,
      product_version: p.productVersion,
      activation_date: p.activationDate || null,
      support_type: p.supportType,
    })),
  }
}

// Flattens DRF's { field: ["error msg"] } into one readable string.
function flattenApiErrors(data) {
  if (!data || typeof data !== 'object') return 'Something went wrong. Please try again.'
  if (data.detail) return data.detail
  return Object.entries(data)
    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
    .join('\n')
}

// Decorative click ripple for .btn-primary and .btn-secondary buttons.
function spawnButtonRipple(e) {
  const el = e.currentTarget
  if (el.disabled) return
  const rect = el.getBoundingClientRect()
  const size = Math.max(rect.width, rect.height) * 1.4
  const ripple = document.createElement('span')
  ripple.className = 'btn-ripple'
  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  el.appendChild(ripple)
  setTimeout(() => ripple.remove(), 650)
}

function Onboarding() {
  const [step, setStep] = useState(1)
  const [activeSection, setActiveSection] = useState(0) // Step 1 sub-section (0-3)
  const [formData, setFormData] = useState(initialFormData)
  const [products, setProducts] = useState([])
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState({})
  const [submittedCode, setSubmittedCode] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')

  // Debounced "is this mobile number already registered?" check state.
  const [mobileCheck, setMobileCheck] = useState({ status: 'idle', value: '' })

  // Product catalog fetched from the backend, as full {id, name, version} objects.
  const [productCatalog, setProductCatalog] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)

  // Admin-editable dropdown options (Company Type, Industry Type, Annual Turnover,
  // No. of Employees, AMC Status, Support Channel/Time, Support Type) — see
  // DropdownOption in the backend and manage these from the Django admin.
  const [dropdownOptions, setDropdownOptions] = useState({})

  // Full country list, and states/provinces for the currently selected country.
  const countries = useMemo(() => Country.getAllCountries(), [])
  const selectedCountry = useMemo(
    () => countries.find((c) => c.name === formData.country),
    [countries, formData.country]
  )
  const statesForCountry = useMemo(
    () => (selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : []),
    [selectedCountry]
  )
  const callingCode = useMemo(() => {
    if (!selectedCountry || !isSupportedCountry(selectedCountry.isoCode)) return null
    try {
      return getCountryCallingCode(selectedCountry.isoCode)
    } catch {
      return null
    }
  }, [selectedCountry])

  // Max digit length for the Mobile/Phone fields, per selected country.
  const mobileMaxLength = useMemo(() => {
    if (!selectedCountry) return 15
    try {
      const example = getExampleNumber(selectedCountry.isoCode, examplesMobile)
      return example ? example.nationalNumber.length : 15
    } catch {
      return 15
    }
  }, [selectedCountry])

  // Postal code length/format hint for the selected country.
  const postalMeta = selectedCountry
    ? (POSTAL_CODE_META[selectedCountry.isoCode] || DEFAULT_POSTAL_META)
    : DEFAULT_POSTAL_META

  // Debounced duplicate check against the check-mobile/ endpoint.
  useEffect(() => {
    const value = formData.mobileNumber
    const iso = selectedCountry?.isoCode

    if (!value || !iso || !isSupportedCountry(iso) || !isValidPhoneNumber(value, iso)) {
      setMobileCheck({ status: 'idle', value: '' })
      return
    }

    let cancelled = false
    setMobileCheck({ status: 'checking', value })

    const timer = setTimeout(() => {
      api.get('check-mobile/', { params: { mobile_number: value, country_code: iso } })
        .then(({ data }) => {
          if (cancelled) return
          setMobileCheck({ status: data?.exists ? 'taken' : 'available', value })
        })
        .catch(() => {
          // Endpoint missing/unreachable — don't block the person over it.
          if (cancelled) return
          setMobileCheck({ status: 'idle', value: '' })
        })
    }, 500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [formData.mobileNumber, selectedCountry])

  // Groups every version row under one entry per product, keyed by normalizeName.
  const productGroups = useMemo(() => {
    const byKey = new Map()
    productCatalog.forEach((p) => {
      const key = normalizeName(p.name)
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push(p)
    })
    return Array.from(byKey.entries()).map(([key, versions]) => {
      const sorted = [...versions].sort((a, b) => {
        const aTime = a.activation_date ? new Date(a.activation_date).getTime() : -Infinity
        const bTime = b.activation_date ? new Date(b.activation_date).getTime() : -Infinity
        if (bTime !== aTime) return bTime - aTime
        return (b.id > a.id ? 1 : -1)
      })
      return { key, name: sorted[0].name, versions: sorted }
    })
  }, [productCatalog])

  // One chip per product group, not per version row.
  const productOptions = productGroups.map((g) => g.name)

  useEffect(() => {
    let cancelled = false
    api.get('public-products/')
      .then(({ data }) => {
        if (cancelled) return
        setProductCatalog(data)
      })
      .catch(() => {
        if (!cancelled) setApiError('Could not load the product list. Please refresh the page.')
      })
      .finally(() => {
        if (!cancelled) setProductsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get('dropdown-options/')
      .then(({ data }) => {
        if (cancelled) return
        setDropdownOptions(data)
        // These fields default to the first available option, same as the
        // old hardcoded arrays did — but only once the real list has loaded.
        setFormData((prev) => ({
          ...prev,
          industryType: prev.industryType || data.industry_type?.[0] || '',
          annualTurnover: prev.annualTurnover || data.turnover_range?.[0] || '',
          employeeCount: prev.employeeCount || data.employee_range?.[0] || '',
          amcStatus: prev.amcStatus || data.amc_status?.[0] || '',
          preferredChannel: prev.preferredChannel || data.support_channel?.[0] || '',
          preferredTime: prev.preferredTime || data.support_time?.[0] || '',
        }))
      })
      .catch(() => {
        if (!cancelled) setApiError('Could not load form options. Please refresh the page.')
      })
    return () => { cancelled = true }
  }, [])

  // Derives Step 2's product blocks from the chips checked in Step 1,
  // preserving existing block data and dropping unchecked products.
  useEffect(() => {
    setProducts((prev) =>
      formData.productsInUse.map((name) => {
        const existing = prev.find((p) => normalizeName(p.productName) === normalizeName(name))
        if (existing) return existing
        const group = productGroups.find((g) => normalizeName(g.name) === normalizeName(name))
        const versions = (group?.versions || [])
          .filter((c) => c.version)
          .map((c) => c.version)
        return { ...emptyProduct(), productName: name, productVersion: versions[0] || '' }
      })
    )
  }, [formData.productsInUse, productGroups])

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  // PAN is embedded in a GSTIN as characters 3-12 (state code + PAN + entity/checksum suffix).
  const handleGstNumberChange = (value) => {
    updateField('gstNumber', value)
    if (value.length >= 15) {
      updateField('panNumber', value.slice(2, -3).toUpperCase())
    }
  }

  // Clears state and pincode/phone errors when the country changes.
  const handleCountryChange = (isoCode) => {
    const c = countries.find((x) => x.isoCode === isoCode)
    if (!c) return
    setFormData((prev) => ({ ...prev, country: c.name, state: '' }))
    setErrors((prev) => ({ ...prev, country: undefined, state: undefined, pincode: undefined, mobileNumber: undefined, phoneNumber: undefined }))
  }

  const handleStateChange = (isoCode) => {
    const s = statesForCountry.find((x) => x.isoCode === isoCode)
    updateField('state', s ? s.name : '')
  }

  const toggleProduct = (name) => {
    setFormData((prev) => {
      const exists = prev.productsInUse.includes(name)
      return {
        ...prev,
        productsInUse: exists
          ? prev.productsInUse.filter((p) => p !== name)
          : [...prev.productsInUse, name],
      }
    })
  }

  const updateProduct = (index, field, value) => {
    setProducts((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  // ---------- Validation ----------

  // Full Step 1 validation across every section, used as the final gate before Step 2.
  const computeStep1Errors = () => {
    const required = {
      companyName: 'Company name is required',
      companyType: 'Company type is required',
      gstNumber: 'GST number is required',
      addressLine1: 'Address line 1 is required',
      city: 'City is required',
      state: 'State is required',
      country: 'Country is required',
      pincode: 'Pincode is required',
      contactName: 'Contact person name is required',
      email: 'Email is required',
      mobileNumber: 'Mobile number is required',
      password: 'Password is required',
      confirmPassword: 'Please confirm your password',
    }
    const nextErrors = {}
    Object.entries(required).forEach(([field, message]) => {
      if (!String(formData[field] || '').trim()) nextErrors[field] = message
    })
    if (formData.gstNumber && selectedCountry?.isoCode === 'IN' && !GSTIN_PATTERN.test(formData.gstNumber)) {
      nextErrors.gstNumber = 'Enter a valid 15-character GSTIN'
    }
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address'
    }
    if (formData.pincode && selectedCountry && postcodeValidatorExistsForCountry(selectedCountry.isoCode)) {
      if (!postcodeValidator(formData.pincode, selectedCountry.isoCode)) {
        nextErrors.pincode = `Enter a valid pincode for ${selectedCountry.name}`
      }
    }
    if (formData.mobileNumber && selectedCountry && isSupportedCountry(selectedCountry.isoCode)) {
      if (!isValidPhoneNumber(formData.mobileNumber, selectedCountry.isoCode)) {
        nextErrors.mobileNumber = `Enter a valid mobile number for ${selectedCountry.name}`
      } else if (mobileCheck.value === formData.mobileNumber && mobileCheck.status === 'taken') {
        nextErrors.mobileNumber = 'This mobile number is already registered'
      }
    }
    if (formData.phoneNumber && selectedCountry && isSupportedCountry(selectedCountry.isoCode)) {
      if (!isValidPhoneNumber(formData.phoneNumber, selectedCountry.isoCode)) {
        nextErrors.phoneNumber = `Enter a valid phone number for ${selectedCountry.name}`
      }
    }
    if (formData.password && formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters'
    }
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }
    if (!formData.amcStatus) nextErrors.amcStatus = 'AMC status is required'
    if (!formData.amcStartDate) nextErrors.amcStartDate = 'AMC start date is required'
    if (!formData.amcEndDate) nextErrors.amcEndDate = 'AMC end date is required'
    if (formData.productsInUse.length === 0) nextErrors.productsInUse = 'Select at least one product or service'
    return nextErrors
  }

  // Lighter check scoped to just one sub-section — used by that section's
  // own "Continue" button so people get immediate, localized feedback.
  const validateSection = (idx) => {
    const requiredMap = SECTION_REQUIRED[idx]
    const nextErrors = { ...errors }
    let ok = true

    Object.entries(requiredMap).forEach(([field, message]) => {
      if (!String(formData[field] || '').trim()) {
        nextErrors[field] = message
        ok = false
      } else {
        nextErrors[field] = undefined
      }
    })

    if (idx === 0) {
      if (formData.gstNumber && selectedCountry?.isoCode === 'IN' && !GSTIN_PATTERN.test(formData.gstNumber)) {
        nextErrors.gstNumber = 'Enter a valid 15-character GSTIN'
        ok = false
      }
    }

    if (idx === 1) {
      if (formData.pincode && selectedCountry && postcodeValidatorExistsForCountry(selectedCountry.isoCode)) {
        if (!postcodeValidator(formData.pincode, selectedCountry.isoCode)) {
          nextErrors.pincode = `Enter a valid pincode for ${selectedCountry.name}`
          ok = false
        }
      }
    }

    if (idx === 2) {
      if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
        nextErrors.email = 'Enter a valid email address'
        ok = false
      }
      if (formData.mobileNumber && selectedCountry && isSupportedCountry(selectedCountry.isoCode)) {
        if (!isValidPhoneNumber(formData.mobileNumber, selectedCountry.isoCode)) {
          nextErrors.mobileNumber = `Enter a valid mobile number for ${selectedCountry.name}`
          ok = false
        } else if (mobileCheck.value === formData.mobileNumber && mobileCheck.status === 'taken') {
          nextErrors.mobileNumber = 'This mobile number is already registered'
          ok = false
        }
      }
      if (formData.phoneNumber && selectedCountry && isSupportedCountry(selectedCountry.isoCode)) {
        if (!isValidPhoneNumber(formData.phoneNumber, selectedCountry.isoCode)) {
          nextErrors.phoneNumber = `Enter a valid phone number for ${selectedCountry.name}`
          ok = false
        }
      }
      if (formData.password && formData.password.length < 8) {
        nextErrors.password = 'Password must be at least 8 characters'
        ok = false
      }
      if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
        nextErrors.confirmPassword = 'Passwords do not match'
        ok = false
      }
    }

    if (idx === 3) {
      if (!formData.amcStatus) {
        nextErrors.amcStatus = 'AMC status is required'
        ok = false
      }
      if (!formData.amcStartDate) {
        nextErrors.amcStartDate = 'AMC start date is required'
        ok = false
      }
      if (!formData.amcEndDate) {
        nextErrors.amcEndDate = 'AMC end date is required'
        ok = false
      }
      if (formData.productsInUse.length === 0) {
        nextErrors.productsInUse = 'Select at least one product or service'
        ok = false
      }
    }

    setErrors(nextErrors)
    return ok
  }

  const sectionHasError = (idx) => SECTION_FIELDS[idx].some((f) => errors[f])

  const handleSectionContinue = () => {
    if (!validateSection(activeSection)) return
    if (activeSection < 3) {
      setActiveSection(activeSection + 1)
    } else {
      goToStep2()
    }
  }

  // Re-checks every section and jumps to the first one with an error.
  const goToStep2 = () => {
    const nextErrors = computeStep1Errors()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) {
      setStep(2)
      return
    }
    const firstInvalid = SECTION_FIELDS.findIndex((fields) => fields.some((f) => nextErrors[f]))
    setActiveSection(firstInvalid === -1 ? 0 : firstInvalid)
  }

  const handleNextFromStep2 = () => {
    setStep(3)
  }

  // ---------- Backend calls ----------

  const handleSubmit = async () => {
    if (!confirmed) return
    setIsSubmitting(true)
    setApiError('')
    try {
      const payload = toBackendPayload(formData, products)
      const res = await api.post('/onboarding/submit/', payload)
      setSubmittedCode(res.data.company_code)
      setStep(4)
    } catch (err) {
      setApiError(flattenApiErrors(err.response?.data))
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderApiError = () =>
    apiError ? <div className="api-error-banner">{apiError}</div> : null

  // ---------- Sidebar ----------

  const renderSidebar = () => (
    <aside className="onboarding-sidebar">
      <div className="sidebar-brand">
        <img className="brand-mark" src="/logo.png" alt="TIXA" />
        <div>
          <div className="brand-title">TIXA</div>
          <div className="brand-subtitle">Create your company account</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">Setup</div>
        {STEP_LABELS.map((label, i) => {
          const num = i + 1
          const isDone = step > num || step === 4
          const isActive = step === num
          return (
            <div className="sidebar-nav-group" key={label}>
              <div
                className={`sidebar-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                onClick={() => { if (isDone) setStep(num) }}
              >
                <div className="sidebar-step-circle">{isDone ? '✓' : num}</div>
                <div className="sidebar-step-title">{label}</div>
              </div>

              {num === 1 && step === 1 && (
                <div className="sidebar-substeps">
                  {SECTION_META.map((s, si) => (
                    <div
                      key={s.key}
                      className={`sidebar-substep ${activeSection === si ? 'active' : ''}`}
                      onClick={() => setActiveSection(si)}
                    >
                      <span className="sidebar-substep-dot" />
                      <span>{s.label}</span>
                      {sectionHasError(si) && <span className="sidebar-substep-flag">!</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Compact standalone login link shown only on mobile. */}
      <Link to="/login" className="sidebar-login-link-mobile">
        Log in <span className="sidebar-login-link-arrow">→</span>
      </Link>

      <div className="sidebar-footer">
        <div className="sidebar-footer-title">Need a hand?</div>
        <p className="sidebar-footer-text">
          Your account stays pending until an admin reviews it — you're free to revisit any section before submitting.
        </p>
        <Link to="/login" className="sidebar-login-link">
          Already have an account? <span className="sidebar-login-link-arrow">Log in →</span>
        </Link>
      </div>
    </aside>
  )

  // ---------- Main header (breadcrumb + heading, mirrors the dashboard) ----------

  const renderMainHeader = () => {
    // key forces a remount so the entrance animation replays on step/section change.
    if (step === 1) {
      const meta = SECTION_META[activeSection]
      return (
        <div className="main-header" key={`header-1-${activeSection}`}>
          <div className="main-eyebrow">ONBOARDING · SECTION {activeSection + 1} OF {SECTION_META.length}</div>
          <h1 className="main-heading">{meta.heading}</h1>
          <p className="main-subtitle">{meta.subtitle}</p>
        </div>
      )
    }
    if (step === 2) {
      return (
        <div className="main-header" key="header-2">
          <div className="main-eyebrow">ONBOARDING · STEP 2 OF 3</div>
          <h1 className="main-heading">Product Details</h1>
          <p className="main-subtitle">Set the version and support details for each product selected in the previous step.</p>
        </div>
      )
    }
    if (step === 3) {
      return (
        <div className="main-header" key="header-3">
          <div className="main-eyebrow">ONBOARDING · STEP 3 OF 3</div>
          <h1 className="main-heading">Review &amp; Submit</h1>
          <p className="main-subtitle">Check everything looks right before you send it off for approval.</p>
        </div>
      )
    }
    return null
  }

  // ---------- Step 1 sections ----------

  const renderSectionCompany = () => (
    <div className="form-grid">
      <div className={`form-field ${errors.companyName ? 'error' : ''}`}>
        <label>Company Name<span className="required">*</span></label>
        <input
          placeholder="e.g. Marsh & Fenwick LLP"
          value={formData.companyName}
          onChange={(e) => updateField('companyName', e.target.value)}
        />
        {errors.companyName && <span className="field-error">{errors.companyName}</span>}
      </div>

      <div className="form-field">
        <label>Company Code</label>
        <input
          placeholder="Enter code"
          value={formData.companyCode}
          onChange={(e) => updateField('companyCode', e.target.value)}
        />
      </div>

      <div className={`form-field ${errors.companyType ? 'error' : ''}`}>
        <label>Company Type<span className="required">*</span></label>
        <select value={formData.companyType} onChange={(e) => updateField('companyType', e.target.value)}>
          <option value="">Select</option>
          {(dropdownOptions.company_type || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {errors.companyType && <span className="field-error">{errors.companyType}</span>}
      </div>

      <div className={`form-field ${errors.gstNumber ? 'error' : ''}`}>
        <label>GST Number<span className="required">*</span></label>
        <input placeholder="29ABCDE1234F1Z5" maxLength={15} value={formData.gstNumber} onChange={(e) => handleGstNumberChange(e.target.value)} />
        {errors.gstNumber && <span className="field-error">{errors.gstNumber}</span>}
      </div>

      <div className="form-field">
        <label>PAN Number</label>
        <input placeholder="ABCDE1234F" maxLength={10} value={formData.panNumber} onChange={(e) => updateField('panNumber', e.target.value)} />
      </div>

      <div className="form-field">
        <label>Website<span className="optional">optional</span></label>
        <input placeholder="https://" value={formData.website} onChange={(e) => updateField('website', e.target.value)} />
      </div>

      <div className="form-field">
        <label>Industry Type</label>
        <select value={formData.industryType} onChange={(e) => updateField('industryType', e.target.value)}>
          {(dropdownOptions.industry_type || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="form-field">
        <label>Annual Turnover</label>
        <select value={formData.annualTurnover} onChange={(e) => updateField('annualTurnover', e.target.value)}>
          {(dropdownOptions.turnover_range || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="form-field">
        <label>No. of Employees</label>
        <select value={formData.employeeCount} onChange={(e) => updateField('employeeCount', e.target.value)}>
          {(dropdownOptions.employee_range || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  )

  const renderSectionAddress = () => (
    <div className="form-grid">
      <div className={`form-field full ${errors.addressLine1 ? 'error' : ''}`}>
        <label>Address Line 1<span className="required">*</span></label>
        <input placeholder="Building, street" value={formData.addressLine1} onChange={(e) => updateField('addressLine1', e.target.value)} />
        {errors.addressLine1 && <span className="field-error">{errors.addressLine1}</span>}
      </div>

      <div className="form-field full">
        <label>Address Line 2<span className="optional">optional</span></label>
        <input placeholder="Landmark, area" value={formData.addressLine2} onChange={(e) => updateField('addressLine2', e.target.value)} />
      </div>

      <div className={`form-field ${errors.country ? 'error' : ''}`}>
        <label>Country<span className="required">*</span></label>
        <SearchableSelect
          value={selectedCountry?.isoCode || ''}
          onChange={handleCountryChange}
          options={countries}
          placeholder="Select a country"
          searchPlaceholder="Search countries…"
          getValue={(c) => c.isoCode}
          getLabel={(c) => c.name}
          renderOption={(c) => <>{c.flag} {c.name}</>}
        />
        {errors.country && <span className="field-error">{errors.country}</span>}
      </div>

      <div className={`form-field ${errors.state ? 'error' : ''}`}>
        <label>State / Province<span className="required">*</span></label>
        {statesForCountry.length > 0 ? (
          <SearchableSelect
            value={statesForCountry.find((s) => s.name === formData.state)?.isoCode || ''}
            onChange={handleStateChange}
            options={statesForCountry}
            placeholder="Select a state / province"
            searchPlaceholder="Search…"
            getValue={(s) => s.isoCode}
            getLabel={(s) => s.name}
          />
        ) : (
          <input
            placeholder={selectedCountry ? `State / province in ${selectedCountry.name}` : 'State / province'}
            value={formData.state}
            onChange={(e) => updateField('state', e.target.value)}
          />
        )}
        {errors.state && <span className="field-error">{errors.state}</span>}
      </div>

      <div className={`form-field ${errors.city ? 'error' : ''}`}>
        <label>City<span className="required">*</span></label>
        <input placeholder="Enter your city" value={formData.city} onChange={(e) => updateField('city', e.target.value)} />
        {errors.city && <span className="field-error">{errors.city}</span>}
      </div>

      <div className={`form-field ${errors.pincode ? 'error' : ''}`}>
        <label>Pincode<span className="required">*</span></label>
        <input
          placeholder={postalMeta.example ? `e.g. ${postalMeta.example}` : '682016'}
          maxLength={postalMeta.maxLength}
          value={formData.pincode}
          onChange={(e) => updateField('pincode', e.target.value.slice(0, postalMeta.maxLength))}
        />
        {errors.pincode && <span className="field-error">{errors.pincode}</span>}
      </div>
    </div>
  )

  const renderSectionContact = () => (
    <div className="form-grid">
      <div className={`form-field ${errors.contactName ? 'error' : ''}`}>
        <label>Contact Person Name<span className="required">*</span></label>
        <input placeholder="Full name" value={formData.contactName} onChange={(e) => updateField('contactName', e.target.value)} />
        {errors.contactName && <span className="field-error">{errors.contactName}</span>}
      </div>

      <div className="form-field">
        <label>Designation</label>
        <input placeholder="e.g. IT Manager" value={formData.designation} onChange={(e) => updateField('designation', e.target.value)} />
      </div>

      <div className={`form-field ${errors.email ? 'error' : ''}`}>
        <label>Email<span className="required">*</span></label>
        <input placeholder="used as login ID" value={formData.email} onChange={(e) => updateField('email', e.target.value)} />
        {errors.email && <span className="field-error">{errors.email}</span>}
      </div>

      <div className={`form-field ${errors.mobileNumber ? 'error' : ''}`}>
        <label>Mobile Number<span className="required">*</span></label>
        <div className="phone-input">
          <span className="phone-prefix">{callingCode ? `+${callingCode}` : '+'}</span>
          <input
            placeholder="9845021190"
            inputMode="numeric"
            maxLength={mobileMaxLength}
            value={formData.mobileNumber}
            onChange={(e) => updateField('mobileNumber', digitsOnly(e.target.value, mobileMaxLength))}
          />
        </div>
        {errors.mobileNumber && <span className="field-error">{errors.mobileNumber}</span>}
        {!errors.mobileNumber && mobileCheck.value === formData.mobileNumber && mobileCheck.status === 'checking' && (
          <span className="field-hint">Checking availability…</span>
        )}
        {!errors.mobileNumber && mobileCheck.value === formData.mobileNumber && mobileCheck.status === 'available' && (
          <span className="field-success">✓ Available</span>
        )}
        {!errors.mobileNumber && mobileCheck.value === formData.mobileNumber && mobileCheck.status === 'taken' && (
          <span className="field-error">This mobile number is already registered</span>
        )}
      </div>

      <div className={`form-field ${errors.phoneNumber ? 'error' : ''}`}>
        <label>Phone Number<span className="optional">optional</span></label>
        <div className="phone-input">
          <span className="phone-prefix">{callingCode ? `+${callingCode}` : '+'}</span>
          <input
            placeholder="Landline"
            inputMode="numeric"
            maxLength={mobileMaxLength}
            value={formData.phoneNumber}
            onChange={(e) => updateField('phoneNumber', digitsOnly(e.target.value, mobileMaxLength))}
          />
        </div>
        {errors.phoneNumber && <span className="field-error">{errors.phoneNumber}</span>}
      </div>

      <div className="form-field">
        <label>Alternate Email<span className="optional">optional</span></label>
        <input placeholder="backup contact" value={formData.alternateEmail} onChange={(e) => updateField('alternateEmail', e.target.value)} />
      </div>

      <div className={`form-field ${errors.password ? 'error' : ''}`}>
        <label>Password<span className="required">*</span></label>
        <input
          type="password"
          placeholder="At least 8 characters"
          value={formData.password}
          onChange={(e) => updateField('password', e.target.value)}
        />
        {errors.password && <span className="field-error">{errors.password}</span>}
      </div>

      <div className={`form-field ${errors.confirmPassword ? 'error' : ''}`}>
        <label>Confirm Password<span className="required">*</span></label>
        <input
          type="password"
          placeholder="Re-enter password"
          value={formData.confirmPassword}
          onChange={(e) => updateField('confirmPassword', e.target.value)}
        />
        {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
      </div>
    </div>
  )

  const renderSectionAdditional = () => (
    <div className="form-grid">
      <div className={`form-field ${errors.amcStatus ? 'error' : ''}`}>
        <label>AMC Status<span className="required">*</span></label>
        <select value={formData.amcStatus} onChange={(e) => updateField('amcStatus', e.target.value)}>
          {(dropdownOptions.amc_status || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="form-field">
        <label>Contract Reference No.<span className="optional">optional</span></label>
        <input placeholder="AGR-2026-0417" value={formData.contractRefNumber} onChange={(e) => updateField('contractRefNumber', e.target.value)} />
      </div>

      <div className={`form-field ${errors.amcStartDate ? 'error' : ''}`}>
        <label>AMC Start Date<span className="required">*</span></label>
        <input type="date" value={formData.amcStartDate} onChange={(e) => updateField('amcStartDate', e.target.value)} />
        {errors.amcStartDate && <span className="field-error">{errors.amcStartDate}</span>}
      </div>

      <div className={`form-field ${errors.amcEndDate ? 'error' : ''}`}>
        <label>AMC End Date<span className="required">*</span></label>
        <input type="date" value={formData.amcEndDate} onChange={(e) => updateField('amcEndDate', e.target.value)} />
        {errors.amcEndDate && <span className="field-error">{errors.amcEndDate}</span>}
      </div>

      <div className="form-field">
        <label>Preferred Support Channel</label>
        <select value={formData.preferredChannel} onChange={(e) => updateField('preferredChannel', e.target.value)}>
          {(dropdownOptions.support_channel || []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="form-field">
        <label>Preferred Support Time</label>
        <select value={formData.preferredTime} onChange={(e) => updateField('preferredTime', e.target.value)}>
          {(dropdownOptions.support_time || []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className={`form-field full ${errors.productsInUse ? 'error' : ''}`}>
        <label>Product(s) / Service(s) in Use<span className="required">*</span></label>
        <div className="chip-select">
          {productsLoading && <span className="muted-note">Loading products…</span>}
          {!productsLoading && productOptions.length === 0 && (
            <span className="muted-note">No products available. Contact an admin.</span>
          )}
          {productOptions.map((p) => (
            <div
              key={p}
              className={`chip ${formData.productsInUse.includes(p) ? 'selected' : ''}`}
              onClick={() => toggleProduct(p)}
            >
              {p}
            </div>
          ))}
        </div>
        {errors.productsInUse && <span className="field-error">{errors.productsInUse}</span>}
      </div>
    </div>
  )

  const renderStep1 = () => (
    <div className="onboarding-card">
      {renderApiError()}

      {activeSection === 0 && renderSectionCompany()}
      {activeSection === 1 && renderSectionAddress()}
      {activeSection === 2 && renderSectionContact()}
      {activeSection === 3 && renderSectionAdditional()}

      <div className="onboarding-actions">
        {activeSection > 0
          ? (
            <button
              className="btn btn-secondary"
              onClick={() => setActiveSection(activeSection - 1)}
              onMouseDown={spawnButtonRipple}
            >
              <span className="btn-back-arrow">←</span> Back
            </button>
          )
          : <div />}
        <button className="btn btn-primary" onClick={handleSectionContinue} onMouseDown={spawnButtonRipple}>
          {activeSection < 3 ? 'Continue →' : 'Next: Product Details →'}
        </button>
      </div>
    </div>
  )

  // ---------- Step 2 ----------

  const renderStep2 = () => (
    <div className="onboarding-card">
      {renderApiError()}

      {products.length === 0 && (
        <p className="muted-note">
          No products selected. Go back and choose at least one product or service.
        </p>
      )}

      {products.map((product, index) => {
        // Available versions for this product, matched via normalizeName.
        const availableVersions = productCatalog
          .filter((p) => normalizeName(p.name) === normalizeName(product.productName) && p.version)
          .map((p) => p.version)

        return (
          <div className="product-block" key={product.productName}>
            <div className="product-block-header">
              <div className="product-block-title">{product.productName}</div>
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>Product Version</label>
                <select
                  value={product.productVersion}
                  onChange={(e) => updateProduct(index, 'productVersion', e.target.value)}
                  disabled={availableVersions.length === 0}
                >
                  {availableVersions.length === 0 ? (
                    <option value="">No version on file</option>
                  ) : (
                    availableVersions.map((v) => <option key={v} value={v}>{v}</option>)
                  )}
                </select>
              </div>

              <div className="form-field">
                <label>Date of Activation</label>
                <input type="date" value={product.activationDate} onChange={(e) => updateProduct(index, 'activationDate', e.target.value)} />
              </div>

              <div className="form-field full">
                <label>Current Support Type</label>
                <div className="segmented">
                  {(dropdownOptions.support_type || []).map((type) => (
                    <label className="segmented-option" key={type}>
                      <input
                        type="radio"
                        name={`supportType-${index}`}
                        checked={product.supportType === type}
                        onChange={() => updateProduct(index, 'supportType', type)}
                      />
                      <span className="segmented-label">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <div className="onboarding-actions">
        <button className="btn btn-secondary" onClick={() => setStep(1)} onMouseDown={spawnButtonRipple}>
          <span className="btn-back-arrow">←</span> Back
        </button>
        <button className="btn btn-primary" onClick={handleNextFromStep2} onMouseDown={spawnButtonRipple}>Next: Review & Submit →</button>
      </div>
    </div>
  )

  // ---------- Step 3 ----------

  const renderStep3 = () => (
    <div className="onboarding-card">
      {renderApiError()}
      <div className="review-block">
        <div className="review-block-title">Company & Contact Overview</div>
        <div className="review-grid">
          <div className="review-item">
            <div className="review-label">Company Name</div>
            <div className="review-value">{formData.companyName || '—'}</div>
          </div>
          <div className="review-item">
            <div className="review-label">Company Type</div>
            <div className="review-value">{formData.companyType || '—'}</div>
          </div>
          <div className="review-item">
            <div className="review-label">GST Number</div>
            <div className="review-value">{formData.gstNumber || '—'}</div>
          </div>
          <div className="review-item">
            <div className="review-label">Contact Person</div>
            <div className="review-value">{formData.contactName || '—'}</div>
          </div>
          <div className="review-item">
            <div className="review-label">Email (Login ID)</div>
            <div className="review-value">{formData.email || '—'}</div>
          </div>
          <div className="review-item">
            <div className="review-label">Mobile</div>
            <div className="review-value">{formData.mobileNumber ? `${callingCode ? `+${callingCode}` : ''} ${formData.mobileNumber}` : '—'}</div>
          </div>
          <div className="review-item" style={{ gridColumn: '1 / -1' }}>
            <div className="review-label">Address</div>
            <div className="review-value">
              {[formData.addressLine1, formData.addressLine2, formData.city, formData.state, formData.pincode]
                .filter(Boolean)
                .join(', ') || '—'}
            </div>
          </div>
          <div className="review-item">
            <div className="review-label">AMC Status</div>
            <div className="review-value">{formData.amcStatus || '—'}</div>
          </div>
          <div className="review-item">
            <div className="review-label">Contract Reference</div>
            <div className="review-value">{formData.contractRefNumber || '—'}</div>
          </div>
        </div>
      </div>

      <div className="review-block">
        <div className="review-block-title">Products</div>
        <div className="review-chips">
          {products.map((p, i) => (
            <span className="review-chip" key={i}>
              {p.productName}{p.productVersion ? ` · v${p.productVersion}` : ''} · {p.supportType}
            </span>
          ))}
        </div>
      </div>

      <label className="confirm-row">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I confirm the details above are accurate and I'm authorised to submit this registration on behalf of my company.
      </label>

      <div className="onboarding-actions">
        <button className="btn btn-secondary" onClick={() => setStep(2)} onMouseDown={spawnButtonRipple}>
          <span className="btn-back-arrow">←</span> Back to Product Details
        </button>
        <button className="btn btn-primary" disabled={!confirmed || isSubmitting} onClick={handleSubmit} onMouseDown={spawnButtonRipple}>
          {isSubmitting ? 'Submitting...' : 'Submit Project'}
        </button>
      </div>
    </div>
  )

  // ---------- Step 4: submitted ----------

  const renderPending = () => (
    <div className="pending-card">
      <div className="pending-icon">✓</div>
      <div className="pending-title">Account Pending Approval</div>
      <p className="pending-text">
        Thanks, {formData.contactName || 'there'}. Your registration for {formData.companyName || 'your company'} has
        been submitted and is under review by our team.
      </p>
      <p className="pending-text">
        You'll receive a confirmation email at <strong>{formData.email || 'your registered email'}</strong> shortly.
        You won't be able to log in until an admin approves the account — once approved, you can log in with your
        mobile number and the password you just set.
      </p>
      <div className="pending-note">Reference: {submittedCode || formData.contractRefNumber || 'Not provided'}</div>
    </div>
  )

  return (
    <div className="onboarding-layout">
      {renderSidebar()}
      {/* has-substeps: reserves clearance on mobile for the sub-section overlay. */}
      <main className={`onboarding-main${step === 1 ? ' has-substeps' : ''}`}>
        <div className="onboarding-shell">
          {renderMainHeader()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderPending()}
        </div>
      </main>
    </div>
  )
}

export default Onboarding