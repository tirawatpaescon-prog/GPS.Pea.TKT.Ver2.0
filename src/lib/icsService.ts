export interface NewMeterRequest {
  requestId: string;          // เลขที่คำร้องขอติดตั้งมิเตอร์
  ca: string;                 // หมายเลขผู้ใช้ไฟฟ้า / บัญชีแสดงสัญญา (CA)
  applicantName: string;      // ชื่อ-นามสกุล ผู้ขอติดตั้ง
  address: string;            // สถานที่ขอติดตั้งมิเตอร์
  meterType: string;          // ประเภทมิเตอร์ (เช่น 1 Phase 15(45)A, 3 Phase 15(45)A)
  voltageLevel?: string;       // ระดับแรงดันไฟฟ้า
  requestDate: string;        // วันที่ยื่นคำร้อง
  status: 'PENDING' | 'SURVEYED' | 'APPROVED' | 'INSTALLED' | 'REJECTED'; // สถานะคำร้อง
  latitude?: number;          // พิกัดละติจูด
  longitude?: number;         // พิกัดลองจิจูด
  phone?: string;             // เบอร์โทรศัพท์ผู้ติดต่อ
  peaOffice?: string;         // การไฟฟ้าส่วนภูมิภาคที่รับผิดชอบ
}

/**
 * ดึงข้อมูลคำร้องขอติดตั้งมิเตอร์ใหม่ทั้งหมดจากระบบ ICS (Inter-System Connectivity)
 * 
 * @param apiBaseUrl - Base URL สำหรับเชื่อมต่อ API ระบบ ICS (Default: '/api/ics')
 * @param options - ตัวเลือกเพิ่มเติม เช่น Signal สำหรับ AbortController หรือ Headers
 * @returns Promise<NewMeterRequest[]> รายการคำร้องขอติดตั้งมิเตอร์ใหม่ทั้งหมด
 */
export async function getAllNewMeterRequests(
  apiBaseUrl: string = '/api/ics',
  options?: { signal?: AbortSignal; headers?: Record<string, string> }
): Promise<NewMeterRequest[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/meter-requests/new`, {
      method: 'GET',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options?.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`ไม่สามารถดึงข้อมูลคำร้องติดตั้งมิเตอร์ใหม่จาก ICS ได้ (Status: ${response.status} ${response.statusText})`);
    }

    const resData = await response.json();

    // รองรับโครงสร้าง Response หลากหลายรูปแบบจากระบบ ICS
    if (Array.isArray(resData)) {
      return resData;
    } else if (resData && Array.isArray(resData.requests)) {
      return resData.requests;
    } else if (resData && Array.isArray(resData.data)) {
      return resData.data;
    }

    return [];
  } catch (error) {
    console.error('[ICS Service] getAllNewMeterRequests Error:', error);
    throw error;
  }
}
