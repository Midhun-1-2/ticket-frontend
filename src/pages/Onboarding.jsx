import React, { useState } from 'react'
import '/src/Onboarding.css'
import api from '/src/api.js'

// ---------- Static dropdown options ----------

const COMPANY_TYPES = ['Private Limited', 'Public Limited', 'LLP', 'Partnership', 'Sole Proprietorship', 'Government', 'Non-Profit']
const INDUSTRY_TYPES = ['Retail', 'IT / Software', 'Manufacturing', 'Healthcare', 'Education', 'Finance', 'Logistics', 'Other']
const TURNOVER_RANGES = ['< ₹1 Cr', '₹1 Cr - ₹5 Cr', '₹5 Cr - ₹25 Cr', '₹25 Cr - ₹100 Cr', '> ₹100 Cr']
const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '500+']
const STATES = ['Andhra Pradesh', 'Delhi', 'Gujarat', 'Karnataka', 'Kerala', 'Maharashtra', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal']
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'United Arab Emirates', 'Singapore']
const AMC_STATUSES = ['Active', 'Inactive', 'Expired', 'Not Applicable']
const SUPPORT_CHANNELS = ['Email', 'Phone', 'Portal', 'WhatsApp']
const SUPPORT_TIMES = ['9 AM - 6 PM IST', '24x7', 'Custom SLA']
const PRODUCT_OPTIONS = ['Ticket Desk Pro', 'API Gateway', 'SSO Add-on', 'Analytics Suite', 'Mobile App']
const SUPPORT_TYPES = ['AMC', 'NON-AMC', 'SAS']

const STEP_LABELS = ['Company & Contact Details', 'Product Details', 'Review & Submit']

const emptyProduct = () => ({
  productName: PRODUCT_OPTIONS[0],
  productVersion: '',
  activationDate: '',
  supportType: 'AMC',
  remarks: '',
})

const initialFormData = {
  // Section A - Company Information
  companyName: '',
  companyCode: '',
  companyType: '',
  gstNumber: '',
  panNumber: '',
  website: '',
  industryType: INDUSTRY_TYPES[0],
  annualTurnover: TURNOVER_RANGES[0],
  employeeCount: EMPLOYEE_RANGES[0],
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
  amcStatus: AMC_STATUSES[0],
  amcStartDate: '',
  amcEndDate: '',
  preferredChannel: SUPPORT_CHANNELS[0],
  preferredTime: SUPPORT_TIMES[0],
  remarks: '',
  productsInUse: [],
  contractRefNumber: '',
}

// Strips non-digit characters and caps length — used for phone-style inputs.
const digitsOnly = (value, maxLen) => value.replace(/\D/g, '').slice(0, maxLen)

// ---------- camelCase (frontend) <-> snake_case (backend) mapping ----------

function toBackendPayload(formData, products) {
  return {
    company_name: formData.companyName,
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
    remarks: formData.remarks,
    products_in_use: formData.productsInUse,
    contract_ref_number: formData.contractRefNumber,
    products: products.map((p) => ({
      product_name: p.productName,
      product_version: p.productVersion,
      activation_date: p.activationDate || null,
      support_type: p.supportType,
      remarks: p.remarks,
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

function Onboarding() {
  const [step, setStep] = useState(1) // 1, 2, 3, or 4 = submitted
  const [formData, setFormData] = useState(initialFormData)
  const [products, setProducts] = useState([emptyProduct()])
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState({})
  const [submittedCode, setSubmittedCode] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState('')

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
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

  const addProduct = () => setProducts((prev) => [...prev, emptyProduct()])
  const removeProduct = (index) => setProducts((prev) => prev.filter((_, i) => i !== index))

  // ---------- Validation ----------

  const validateStep1 = () => {
    const required = {
      companyName: 'Company name is required',
      companyType: 'Company type is required',
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
    if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address'
    }
    if (formData.mobileNumber && formData.mobileNumber.length !== 10) {
      nextErrors.mobileNumber = 'Mobile number must be exactly 10 digits'
    }
    if (formData.phoneNumber && formData.phoneNumber.length !== 10) {
      nextErrors.phoneNumber = 'Phone number must be exactly 10 digits'
    }
    if (formData.password && formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters'
    }
    if (formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match'
    }
    if (!formData.amcStatus) nextErrors.amcStatus = 'AMC status is required'
    if (formData.productsInUse.length === 0) nextErrors.productsInUse = 'Select at least one product or service'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNextFromStep1 = () => {
    if (validateStep1()) setStep(2)
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

  // ---------- Stepper ----------

  const renderStepper = () => (
    <div className="stepper">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1
        const isDone = step > num || step === 4
        const isActive = step === num
        return (
          <React.Fragment key={label}>
            <div className={`stepper-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
              <div className="stepper-circle">{isDone ? '✓' : num}</div>
              <div className="stepper-label">{label}</div>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`stepper-line ${step > num ? 'done' : ''}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )

  const renderApiError = () =>
    apiError ? (
      <div style={{
        background: '#fdecea', border: '1px solid #f3b4ae', color: '#a3231b',
        borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 18, whiteSpace: 'pre-line',
      }}>
        {apiError}
      </div>
    ) : null

  // ---------- Step 1 ----------

  const renderStep1 = () => (
    <div className="onboarding-card">
      {renderApiError()}
      {/* Section A */}
      <div className="form-section">
        <div className="section-heading">
          <span className="section-badge">A</span> Company Information
        </div>
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
            <input placeholder="Auto-generated after submit" value={formData.companyCode} disabled />
          </div>

          <div className={`form-field ${errors.companyType ? 'error' : ''}`}>
            <label>Company Type<span className="required">*</span></label>
            <select value={formData.companyType} onChange={(e) => updateField('companyType', e.target.value)}>
              <option value="">Select</option>
              {COMPANY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.companyType && <span className="field-error">{errors.companyType}</span>}
          </div>

          <div className="form-field">
            <label>GST Number</label>
            <input placeholder="29ABCDE1234F1Z5" value={formData.gstNumber} onChange={(e) => updateField('gstNumber', e.target.value)} />
          </div>

          <div className="form-field">
            <label>PAN Number</label>
            <input placeholder="ABCDE1234F" value={formData.panNumber} onChange={(e) => updateField('panNumber', e.target.value)} />
          </div>

          <div className="form-field">
            <label>Website<span className="optional">optional</span></label>
            <input placeholder="https://" value={formData.website} onChange={(e) => updateField('website', e.target.value)} />
          </div>

          <div className="form-field">
            <label>Industry Type</label>
            <select value={formData.industryType} onChange={(e) => updateField('industryType', e.target.value)}>
              {INDUSTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label>Annual Turnover</label>
            <select value={formData.annualTurnover} onChange={(e) => updateField('annualTurnover', e.target.value)}>
              {TURNOVER_RANGES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label>No. of Employees</label>
            <select value={formData.employeeCount} onChange={(e) => updateField('employeeCount', e.target.value)}>
              {EMPLOYEE_RANGES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Section B */}
      <div className="form-section">
        <div className="section-heading">
          <span className="section-badge">B</span> Address Details
        </div>
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

          <div className={`form-field ${errors.city ? 'error' : ''}`}>
            <label>City<span className="required">*</span></label>
            <input placeholder="Ernakulam" value={formData.city} onChange={(e) => updateField('city', e.target.value)} />
            {errors.city && <span className="field-error">{errors.city}</span>}
          </div>

          <div className={`form-field ${errors.state ? 'error' : ''}`}>
            <label>State<span className="required">*</span></label>
            <select value={formData.state} onChange={(e) => updateField('state', e.target.value)}>
              <option value="">Select</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {errors.state && <span className="field-error">{errors.state}</span>}
          </div>

          <div className={`form-field ${errors.country ? 'error' : ''}`}>
            <label>Country<span className="required">*</span></label>
            <select value={formData.country} onChange={(e) => updateField('country', e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className={`form-field ${errors.pincode ? 'error' : ''}`}>
            <label>Pincode<span className="required">*</span></label>
            <input placeholder="682016" value={formData.pincode} onChange={(e) => updateField('pincode', e.target.value)} />
            {errors.pincode && <span className="field-error">{errors.pincode}</span>}
          </div>
        </div>
      </div>

      {/* Section C */}
      <div className="form-section">
        <div className="section-heading">
          <span className="section-badge">C</span> Primary Contact Details
        </div>
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
              <span className="phone-prefix">+91</span>
              <input
                placeholder="9845021190"
                inputMode="numeric"
                value={formData.mobileNumber}
                onChange={(e) => updateField('mobileNumber', digitsOnly(e.target.value, 10))}
              />
            </div>
            {errors.mobileNumber && <span className="field-error">{errors.mobileNumber}</span>}
          </div>

          <div className={`form-field ${errors.phoneNumber ? 'error' : ''}`}>
            <label>Phone Number<span className="optional">optional</span></label>
            <div className="phone-input">
              <span className="phone-prefix">+91</span>
              <input
                placeholder="Landline"
                inputMode="numeric"
                value={formData.phoneNumber}
                onChange={(e) => updateField('phoneNumber', digitsOnly(e.target.value, 10))}
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
      </div>

      {/* Section D */}
      <div className="form-section">
        <div className="section-heading">
          <span className="section-badge">D</span> Additional Information
        </div>
        <div className="form-grid">
          <div className={`form-field ${errors.amcStatus ? 'error' : ''}`}>
            <label>AMC Status<span className="required">*</span></label>
            <select value={formData.amcStatus} onChange={(e) => updateField('amcStatus', e.target.value)}>
              {AMC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label>Contract Reference No.<span className="optional">optional</span></label>
            <input placeholder="AGR-2026-0417" value={formData.contractRefNumber} onChange={(e) => updateField('contractRefNumber', e.target.value)} />
          </div>

          <div className="form-field">
            <label>AMC Start Date</label>
            <input type="date" value={formData.amcStartDate} onChange={(e) => updateField('amcStartDate', e.target.value)} />
          </div>

          <div className="form-field">
            <label>AMC End Date</label>
            <input type="date" value={formData.amcEndDate} onChange={(e) => updateField('amcEndDate', e.target.value)} />
          </div>

          <div className="form-field">
            <label>Preferred Support Channel</label>
            <select value={formData.preferredChannel} onChange={(e) => updateField('preferredChannel', e.target.value)}>
              {SUPPORT_CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-field">
            <label>Preferred Support Time</label>
            <select value={formData.preferredTime} onChange={(e) => updateField('preferredTime', e.target.value)}>
              {SUPPORT_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className={`form-field full ${errors.productsInUse ? 'error' : ''}`}>
            <label>Product(s) / Service(s) in Use<span className="required">*</span></label>
            <div className="chip-select">
              {PRODUCT_OPTIONS.map((p) => (
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

          <div className="form-field full">
            <label>Remarks<span className="optional">optional</span></label>
            <textarea
              placeholder="Anything else we should know?"
              maxLength={250}
              value={formData.remarks}
              onChange={(e) => updateField('remarks', e.target.value)}
            />
            <span className="char-count">{formData.remarks.length} / 250</span>
          </div>
        </div>
      </div>

      <div className="onboarding-actions">
        <div />
        <button className="btn btn-primary" onClick={handleNextFromStep1}>Next: Product Details →</button>
      </div>
    </div>
  )

  // ---------- Step 2 ----------

  const renderStep2 = () => (
    <div className="onboarding-card">
      {renderApiError()}
      <div className="form-section">
        <div className="section-heading">Product Details</div>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: -10, marginBottom: 18 }}>
          Add each product or service this company has purchased.
        </p>

        {products.map((product, index) => (
          <div className="product-block" key={index}>
            {products.length > 1 && (
              <div className="product-block-header">
                <div className="product-block-title">Product {index + 1}</div>
                <button className="remove-product-btn" onClick={() => removeProduct(index)}>Remove</button>
              </div>
            )}
            <div className="form-grid">
              <div className="form-field">
                <label>Product Name</label>
                <select value={product.productName} onChange={(e) => updateProduct(index, 'productName', e.target.value)}>
                  {PRODUCT_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="form-field">
                <label>Product Version</label>
                <input placeholder="e.g. 4.2" value={product.productVersion} onChange={(e) => updateProduct(index, 'productVersion', e.target.value)} />
              </div>

              <div className="form-field">
                <label>Date of Activation</label>
                <input type="date" value={product.activationDate} onChange={(e) => updateProduct(index, 'activationDate', e.target.value)} />
              </div>

              <div className="form-field">
                <label>Current Support Type</label>
                <div className="radio-group" style={{ marginTop: 8 }}>
                  {SUPPORT_TYPES.map((type) => (
                    <label className="radio-option" key={type}>
                      <input
                        type="radio"
                        name={`supportType-${index}`}
                        checked={product.supportType === type}
                        onChange={() => updateProduct(index, 'supportType', type)}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-field full">
                <label>Remarks<span className="optional">optional</span></label>
                <textarea
                  placeholder="Version notes, migration details, etc."
                  value={product.remarks}
                  onChange={(e) => updateProduct(index, 'remarks', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        <button className="add-product-btn" onClick={addProduct}>+ Add Another Product</button>
      </div>

      <div className="onboarding-actions">
        <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
        <button className="btn btn-primary" onClick={handleNextFromStep2}>Next: Review & Submit →</button>
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
            <div className="review-value">{formData.mobileNumber ? `+91 ${formData.mobileNumber}` : '—'}</div>
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
        <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back to Product Details</button>
        <button className="btn btn-primary" disabled={!confirmed || isSubmitting} onClick={handleSubmit}>
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
      <div className="pending-note">Reference: {submittedCode || formData.contractRefNumber || 'Will be assigned after approval'}</div>
    </div>
  )

  return (
    <div className="onboarding-page">
      <div className="onboarding-brand">
        <div className="brand-mark">TD</div>
        <div>
          <div className="brand-title">Ticket Desk</div>
          <div className="brand-subtitle">Create your company account</div>
        </div>
      </div>

      <div className="onboarding-shell">
        {step < 4 && renderStepper()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderPending()}
      </div>
    </div>
  )
}

export default Onboarding