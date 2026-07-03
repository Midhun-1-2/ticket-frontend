import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { initCounters, initTrendChart } from '../script.js'

function Dashboard() {

  // Re-run counter animation + trend chart draw whenever this page mounts
  // (App.jsx's initApp() only fires once on first load, so if the user
  // navigates away and back, these need to be re-triggered here).
  useEffect(() => {
    initCounters()
    initTrendChart()
  }, [])

  return (
    <main className="main">
      <div className="content">

        <div className="page-head">
          <div>
            <div className="page-eyebrow">Admin · Overview</div>
            <h1 className="page-title">Good morning, Rahul</h1>
            <p className="page-desc">
              Here's how the support queue is looking today, {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/raise-ticket/" className="btn btn-ghost">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Raise Ticket
            </Link>
            <a href="#" className="btn btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              Assign Tickets
            </a>
          </div>
        </div>

        {/* Signature element: live queue ticker */}
        <div className="ticker">
          <div className="ticker-live"><span className="ticker-dot"></span> LIVE QUEUE</div>
          <div className="ticker-item">Avg first response <b>18m</b></div>
          <div className="ticker-item">Avg resolution <b className="t-accent">3h 12m</b></div>
          <div className="ticker-item"><b className="t-amber">9</b> tickets nearing SLA breach</div>
          <div className="ticker-item"><b className="t-red">3</b> tickets already overdue</div>
          <div className="ticker-item">Last sync <b>just now</b></div>
        </div>

        {/* Summary cards */}
        <div className="stat-grid">
          <div className="stat-card" data-tone="accent">
            <div className="stat-label">Total Tickets</div>
            <div className="stat-value mono" data-count="1284">0</div>
            <div className="stat-foot up">↑ 6.2% vs last week</div>
          </div>
          <div className="stat-card" data-tone="amber">
            <div className="stat-label">Open</div>
            <div className="stat-value mono" data-count="182">0</div>
            <div className="stat-foot">Awaiting first action</div>
          </div>
          <div className="stat-card" data-tone="blue">
            <div className="stat-label">In Progress</div>
            <div className="stat-value mono" data-count="96">0</div>
            <div className="stat-foot">Being worked on</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Resolved</div>
            <div className="stat-value mono" data-count="967">0</div>
            <div className="stat-foot up">↑ 4.1% this month</div>
          </div>
          <div className="stat-card" data-tone="red">
            <div className="stat-label">Overdue</div>
            <div className="stat-value mono" data-count="9">0</div>
            <div className="stat-foot down">Needs escalation</div>
          </div>
          <div className="stat-card" data-tone="violet">
            <div className="stat-label">Pending Approvals</div>
            <div className="stat-value mono" data-count="4">0</div>
            <div className="stat-foot">Accounts + assignments</div>
          </div>
        </div>

        {/* Trend + Staff performance */}
        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Ticket Trend</div>
                <div className="panel-sub">Opened vs. resolved over time</div>
              </div>
              <div className="tabs">
                <button className="tab active" data-trend-tab="daily">Daily</button>
                <button className="tab" data-trend-tab="weekly">Weekly</button>
                <button className="tab" data-trend-tab="monthly">Monthly</button>
              </div>
            </div>
            <div className="panel-body">
              <div className="chart-wrap">
                <canvas id="trendChart"></canvas>
              </div>
              <div className="chart-legend">
                <div className="legend-item"><span className="legend-dot" style={{ background: '#C8791A' }}></span> Opened</div>
                <div className="legend-item"><span className="legend-dot" style={{ background: '#0F6E63' }}></span> Resolved</div>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Staff Performance</div>
                <div className="panel-sub">Active load this week</div>
              </div>
            </div>
            <div className="panel-body">
              <ul className="staff-list">
                <li className="staff-row">
                  <div className="staff-avatar">MN</div>
                  <div className="staff-info">
                    <div className="staff-name">Meera Nair</div>
                    <div className="staff-dept">Billing</div>
                  </div>
                  <div className="staff-metric">
                    <div className="num">14</div>
                    <div className="cap">Assigned</div>
                  </div>
                </li>
                <li className="staff-row">
                  <div className="staff-avatar" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>AM</div>
                  <div className="staff-info">
                    <div className="staff-name">Arjun Menon</div>
                    <div className="staff-dept">Technical</div>
                  </div>
                  <div className="staff-metric">
                    <div className="num">21</div>
                    <div className="cap">Assigned</div>
                  </div>
                </li>
                <li className="staff-row">
                  <div className="staff-avatar" style={{ background: 'var(--amber-soft)', color: '#8A550F' }}>DP</div>
                  <div className="staff-info">
                    <div className="staff-name">Divya Pillai</div>
                    <div className="staff-dept">General</div>
                  </div>
                  <div className="staff-metric">
                    <div className="num">9</div>
                    <div className="cap">Assigned</div>
                  </div>
                </li>
                <li className="staff-row">
                  <div className="staff-avatar" style={{ background: 'var(--violet-soft)', color: 'var(--violet)' }}>KO</div>
                  <div className="staff-info">
                    <div className="staff-name">Ken Osei</div>
                    <div className="staff-dept">Technical</div>
                  </div>
                  <div className="staff-metric">
                    <div className="num">17</div>
                    <div className="cap">Assigned</div>
                  </div>
                </li>
              </ul>
            </div>
          </section>
        </div>

        {/* Recent tickets + category distribution */}
        <div className="grid-2">
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Recent Tickets</div>
                <div className="panel-sub">Newest activity across the queue</div>
              </div>
              <a href="#" className="btn btn-ghost">View all</a>
            </div>
            <div className="panel-body table-wrap">
              <table className="tickets">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Subject / Customer</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="tid">#TD-1042</td>
                    <td className="subject-cell">
                      <div className="subj">Unable to export invoice as PDF</div>
                      <div className="cust">Nimbus Retail Pvt Ltd</div>
                    </td>
                    <td><span className="priority high"><span className="dot"></span>High</span></td>
                    <td><span className="chip open">Open</span></td>
                    <td className="sla warn">42m left</td>
                  </tr>
                  <tr>
                    <td className="tid">#TD-1041</td>
                    <td className="subject-cell">
                      <div className="subj">Login OTP not received on signup</div>
                      <div className="cust">Coral Bay Hotels</div>
                    </td>
                    <td><span className="priority urgent"><span className="dot"></span>Urgent</span></td>
                    <td><span className="chip overdue">Overdue</span></td>
                    <td className="sla breach">Breached 1h 10m</td>
                  </tr>
                  <tr>
                    <td className="tid">#TD-1039</td>
                    <td className="subject-cell">
                      <div className="subj">API rate limit clarification needed</div>
                      <div className="cust">Marsh &amp; Fenwick LLP</div>
                    </td>
                    <td><span className="priority medium"><span className="dot"></span>Medium</span></td>
                    <td><span className="chip progress">In Progress</span></td>
                    <td className="sla ok">5h 20m left</td>
                  </tr>
                  <tr>
                    <td className="tid">#TD-1036</td>
                    <td className="subject-cell">
                      <div className="subj">Refund request for duplicate charge</div>
                      <div className="cust">Verde Organics</div>
                    </td>
                    <td><span className="priority high"><span className="dot"></span>High</span></td>
                    <td><span className="chip hold">On Hold</span></td>
                    <td className="sla ok">1d 2h left</td>
                  </tr>
                  <tr>
                    <td className="tid">#TD-1030</td>
                    <td className="subject-cell">
                      <div className="subj">Dashboard chart not loading on Safari</div>
                      <div className="cust">Pinehall Studio</div>
                    </td>
                    <td><span className="priority low"><span className="dot"></span>Low</span></td>
                    <td><span className="chip resolved">Resolved</span></td>
                    <td className="sla ok">Closed on time</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">By Category</div>
                <div className="panel-sub">Share of open tickets</div>
              </div>
            </div>
            <div className="panel-body">
              <div className="cat-list">
                <div className="cat-row">
                  <div className="cat-name">Technical</div>
                  <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: '72%', background: 'var(--blue)' }}></div></div>
                  <div className="cat-count">72</div>
                </div>
                <div className="cat-row">
                  <div className="cat-name">Billing</div>
                  <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: '48%' }}></div></div>
                  <div className="cat-count">48</div>
                </div>
                <div className="cat-row">
                  <div className="cat-name">General</div>
                  <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: '31%', background: 'var(--amber)' }}></div></div>
                  <div className="cat-count">31</div>
                </div>
                <div className="cat-row">
                  <div className="cat-name">Account</div>
                  <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: '19%', background: 'var(--violet)' }}></div></div>
                  <div className="cat-count">19</div>
                </div>
                <div className="cat-row">
                  <div className="cat-name">Product</div>
                  <div className="cat-bar-track"><div className="cat-bar-fill" style={{ width: '12%', background: 'var(--red)' }}></div></div>
                  <div className="cat-count">12</div>
                </div>
              </div>
            </div>
          </section>
        </div>

      </div>
    </main>
  )
}

export default Dashboard