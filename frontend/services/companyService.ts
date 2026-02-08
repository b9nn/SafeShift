/**
 * Company Management Service
 * 
 * Handles company registration, device linking, and data storage
 */

import { Company, Device, SafetyReport } from '../types/company';

const STORAGE_KEY_COMPANIES = 'safeshift_companies';
const STORAGE_KEY_DEVICES = 'safeshift_devices';
const STORAGE_KEY_REPORTS = 'safeshift_reports';

export class CompanyService {
  /**
   * Register a new company
   */
  static registerCompany(
    name: string,
    walletAddress: string
  ): Company {
    const company: Company = {
      id: `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      walletAddress,
      registeredAt: Date.now(),
      deviceIds: [],
      totalRewardsReceived: 0,
      lastRewardAt: null,
      isActive: true,
    };

    const companies = this.getAllCompanies();
    companies.push(company);
    localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));

    return company;
  }

  /**
   * Get all registered companies
   */
  static getAllCompanies(): Company[] {
    const stored = localStorage.getItem(STORAGE_KEY_COMPANIES);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Get company by ID
   */
  static getCompanyById(id: string): Company | null {
    const companies = this.getAllCompanies();
    return companies.find(c => c.id === id) || null;
  }

  /**
   * Get company by wallet address
   */
  static getCompanyByWallet(walletAddress: string): Company | null {
    const companies = this.getAllCompanies();
    return companies.find(c => c.walletAddress === walletAddress) || null;
  }

  /**
   * Update company
   */
  static updateCompany(company: Company): void {
    const companies = this.getAllCompanies();
    const index = companies.findIndex(c => c.id === company.id);
    if (index !== -1) {
      companies[index] = company;
      localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(companies));
    }
  }

  /**
   * Register a device for a company
   */
  static registerDevice(
    companyId: string,
    name: string,
    location: string
  ): Device {
    const device: Device = {
      id: `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      companyId,
      name,
      location,
      registeredAt: Date.now(),
      isActive: true,
    };

    const devices = this.getAllDevices();
    devices.push(device);
    localStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(devices));

    // Link device to company
    const company = this.getCompanyById(companyId);
    if (company) {
      company.deviceIds.push(device.id);
      this.updateCompany(company);
    }

    return device;
  }

  /**
   * Get all devices
   */
  static getAllDevices(): Device[] {
    const stored = localStorage.getItem(STORAGE_KEY_DEVICES);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Get devices for a company
   */
  static getDevicesByCompany(companyId: string): Device[] {
    const devices = this.getAllDevices();
    return devices.filter(d => d.companyId === companyId);
  }

  /**
   * Get device by ID
   */
  static getDeviceById(id: string): Device | null {
    const devices = this.getAllDevices();
    return devices.find(d => d.id === id) || null;
  }

  /**
   * Store safety report
   */
  static storeSafetyReport(report: SafetyReport): void {
    const reports = this.getAllReports();
    reports.push(report);
    // Keep only last 1000 reports
    const recentReports = reports.slice(-1000);
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(recentReports));
  }

  /**
   * Get all safety reports
   */
  static getAllReports(): SafetyReport[] {
    const stored = localStorage.getItem(STORAGE_KEY_REPORTS);
    return stored ? JSON.parse(stored) : [];
  }

  /**
   * Get reports for a company
   */
  static getReportsByCompany(companyId: string, limit: number = 100): SafetyReport[] {
    const reports = this.getAllReports();
    return reports
      .filter(r => r.companyId === companyId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get latest report for a company
   */
  static getLatestReport(companyId: string): SafetyReport | null {
    const reports = this.getReportsByCompany(companyId, 1);
    return reports.length > 0 ? reports[0] : null;
  }

  /**
   * Update company reward info
   */
  static recordReward(companyId: string, amount: number): void {
    const company = this.getCompanyById(companyId);
    if (company) {
      company.totalRewardsReceived += amount;
      company.lastRewardAt = Date.now();
      this.updateCompany(company);
    }
  }
}
