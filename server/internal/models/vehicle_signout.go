package models

import "time"

// VehicleSignoutAttachment represents an uploaded photo or document for the vehicle handover.
type VehicleSignoutAttachment struct {
	URL          string    `json:"url" firestore:"url"`
	FileName     string    `json:"fileName" firestore:"fileName"`
	Caption      string    `json:"caption,omitempty" firestore:"caption,omitempty"`
	UploadedTime time.Time `json:"uploadedTime" firestore:"uploadedTime"`
}

// VehicleSignoutEquipmentItem represents safety items or equipment checked during handover.
type VehicleSignoutEquipmentItem struct {
	TypeID      int    `json:"typeId" firestore:"typeId"`
	Description string `json:"description" firestore:"description"`
	Label       string `json:"label,omitempty" firestore:"label,omitempty"`
	Checked     bool   `json:"checked" firestore:"checked"`
}

// VehicleSignout represents a Vehicle Sign-Out / Sign-In handover record between Fleet and Driver.
type VehicleSignout struct {
	ID                         string                     `json:"id" firestore:"id"`
	IsSignIn                   bool                       `json:"isSignIn" firestore:"isSignIn"` // false = Sign Out (handover to driver), true = Sign In (returned to yard)
	SignDate                   string                     `json:"signDate" firestore:"signDate"` // YYYY-MM-DD or ISO-8601
	VehicleType                int                        `json:"vehicleType" firestore:"vehicleType"` // 0 = Bus, 1 = Van
	EmployeeID                 string                     `json:"employeeId" firestore:"employeeId"`
	EmployeeName               string                     `json:"employeeName" firestore:"employeeName"`
	RouteID                    string                     `json:"routeId,omitempty" firestore:"routeId,omitempty"`
	RouteName                  string                     `json:"routeName,omitempty" firestore:"routeName,omitempty"`
	CellPhone                  string                     `json:"cellPhone,omitempty" firestore:"cellPhone,omitempty"`
	DriverLicenseClass         string                     `json:"driverLicenseClass,omitempty" firestore:"driverLicenseClass,omitempty"`
	DriverLicenseCondition     string                     `json:"driverLicenseCondition,omitempty" firestore:"driverLicenseCondition,omitempty"`
	UnitID                     int                        `json:"unitId,omitempty" firestore:"unitId,omitempty"`
	UnitNumber                 string                     `json:"unitNumber" firestore:"unitNumber"`
	Odometer                   float64                    `json:"odometer" firestore:"odometer"`
	LicensePlate               string                     `json:"licensePlate,omitempty" firestore:"licensePlate,omitempty"`
	CVIPDate                   string                     `json:"cvipDate,omitempty" firestore:"cvipDate,omitempty"`
	UnitYear                   int                        `json:"unitYear,omitempty" firestore:"unitYear,omitempty"`
	UnitMaker                  string                     `json:"unitMaker,omitempty" firestore:"unitMaker,omitempty"`
	UnitModel                  string                     `json:"unitModel,omitempty" firestore:"unitModel,omitempty"`
	UnitColor                  string                     `json:"unitColor,omitempty" firestore:"unitColor,omitempty"`
	FuelLevelID                int                        `json:"fuelLevelId,omitempty" firestore:"fuelLevelId,omitempty"`
	FuelLevelDescription        string                     `json:"fuelLevelDescription,omitempty" firestore:"fuelLevelDescription,omitempty"`
	FuelTypeID                 int                        `json:"fuelTypeId,omitempty" firestore:"fuelTypeId,omitempty"`
	FuelTypeDescription         string                     `json:"fuelTypeDescription,omitempty" firestore:"fuelTypeDescription,omitempty"`
	DocRegistrationSignIn      bool                       `json:"docRegistrationSignIn" firestore:"docRegistrationSignIn"`
	DocInsuranceSignIn         bool                       `json:"docInsuranceSignIn" firestore:"docInsuranceSignIn"`
	DocSafetyFitnessSignIn     bool                       `json:"docSafetyFitnessSignIn" firestore:"docSafetyFitnessSignIn"`
	DocCollisionReportSignIn   bool                       `json:"docCollisionReportSignIn" firestore:"docCollisionReportSignIn"`
	DocScheduleMaintenanceSignIn bool                     `json:"docScheduleMaintenanceSignIn" firestore:"docScheduleMaintenanceSignIn"`
	DocSDSSignIn               bool                       `json:"docSdsSignIn" firestore:"docSdsSignIn"`
	CheckFireExtinguisher      bool                       `json:"checkFireExtinguisher" firestore:"checkFireExtinguisher"`
	CheckFirstAidKit           bool                       `json:"checkFirstAidKit" firestore:"checkFirstAidKit"`
	CheckTriangles             bool                       `json:"checkTriangles" firestore:"checkTriangles"`
	CheckQstraints             bool                       `json:"checkQstraints" firestore:"checkQstraints"`
	CheckSeatBeltCutter        bool                       `json:"checkSeatBeltCutter" firestore:"checkSeatBeltCutter"`
	CheckBroom                 bool                       `json:"checkBroom" firestore:"checkBroom"`
	CheckSnowbrush             bool                       `json:"checkSnowbrush" firestore:"checkSnowbrush"`
	CheckCleankit              bool                       `json:"checkCleankit" firestore:"checkCleankit"`
	AcknowledgeCheck           bool                       `json:"acknowledgeCheck" firestore:"acknowledgeCheck"`
	ConditionKey               string                     `json:"conditionKey,omitempty" firestore:"conditionKey,omitempty"`
	ConditionComments          string                     `json:"conditionComments,omitempty" firestore:"conditionComments,omitempty"`
	ParkingAddress             string                     `json:"parkingAddress,omitempty" firestore:"parkingAddress,omitempty"`
	FireHallLocation           string                     `json:"fireHallLocation,omitempty" firestore:"fireHallLocation,omitempty"`
	DriverSignature            string                     `json:"driverSignature,omitempty" firestore:"driverSignature,omitempty"`
	DriverSignDate             string                     `json:"driverSignDate,omitempty" firestore:"driverSignDate,omitempty"`
	FleetDepartmentSignature   string                     `json:"fleetDepartmentSignature,omitempty" firestore:"fleetDepartmentSignature,omitempty"`
	FleetDepartmentSignDate    string                     `json:"fleetDepartmentSignDate,omitempty" firestore:"fleetDepartmentSignDate,omitempty"`
	Attachments                []VehicleSignoutAttachment `json:"attachments,omitempty" firestore:"attachments,omitempty"`
	CreatedBy                  string                     `json:"createdBy,omitempty" firestore:"createdBy,omitempty"`
	CreatedAt                  time.Time                  `json:"createdAt" firestore:"createdAt"`
	UpdatedAt                  time.Time                  `json:"updatedAt" firestore:"updatedAt"`
}

// CreateVehicleSignoutPayload represents the payload to create a new vehicle sign-out / handover.
type CreateVehicleSignoutPayload struct {
	IsSignIn                   bool                       `json:"isSignIn"`
	SignDate                   string                     `json:"signDate"`
	VehicleType                int                        `json:"vehicleType"`
	EmployeeID                 string                     `json:"employeeId"`
	EmployeeName               string                     `json:"employeeName"`
	RouteID                    string                     `json:"routeId,omitempty"`
	RouteName                  string                     `json:"routeName,omitempty"`
	CellPhone                  string                     `json:"cellPhone,omitempty"`
	DriverLicenseClass         string                     `json:"driverLicenseClass,omitempty"`
	DriverLicenseCondition     string                     `json:"driverLicenseCondition,omitempty"`
	UnitID                     int                        `json:"unitId,omitempty"`
	UnitNumber                 string                     `json:"unitNumber"`
	Odometer                   float64                    `json:"odometer"`
	LicensePlate               string                     `json:"licensePlate,omitempty"`
	CVIPDate                   string                     `json:"cvipDate,omitempty"`
	UnitYear                   int                        `json:"unitYear,omitempty"`
	UnitMaker                  string                     `json:"unitMaker,omitempty"`
	UnitModel                  string                     `json:"unitModel,omitempty"`
	UnitColor                  string                     `json:"unitColor,omitempty"`
	FuelLevelID                int                        `json:"fuelLevelId,omitempty"`
	FuelLevelDescription        string                     `json:"fuelLevelDescription,omitempty"`
	FuelTypeID                 int                        `json:"fuelTypeId,omitempty"`
	FuelTypeDescription         string                     `json:"fuelTypeDescription,omitempty"`
	DocRegistrationSignIn      bool                       `json:"docRegistrationSignIn"`
	DocInsuranceSignIn         bool                       `json:"docInsuranceSignIn"`
	DocSafetyFitnessSignIn     bool                       `json:"docSafetyFitnessSignIn"`
	DocCollisionReportSignIn   bool                       `json:"docCollisionReportSignIn"`
	DocScheduleMaintenanceSignIn bool                     `json:"docScheduleMaintenanceSignIn"`
	DocSDSSignIn               bool                       `json:"docSdsSignIn"`
	CheckFireExtinguisher      bool                       `json:"checkFireExtinguisher"`
	CheckFirstAidKit           bool                       `json:"checkFirstAidKit"`
	CheckTriangles             bool                       `json:"checkTriangles"`
	CheckQstraints             bool                       `json:"checkQstraints"`
	CheckSeatBeltCutter        bool                       `json:"checkSeatBeltCutter"`
	CheckBroom                 bool                       `json:"checkBroom"`
	CheckSnowbrush             bool                       `json:"checkSnowbrush"`
	CheckCleankit              bool                       `json:"checkCleankit"`
	AcknowledgeCheck           bool                       `json:"acknowledgeCheck"`
	ConditionKey               string                     `json:"conditionKey,omitempty"`
	ConditionComments          string                     `json:"conditionComments,omitempty"`
	ParkingAddress             string                     `json:"parkingAddress,omitempty"`
	FireHallLocation           string                     `json:"fireHallLocation,omitempty"`
	DriverSignature            string                     `json:"driverSignature,omitempty"`
	DriverSignDate             string                     `json:"driverSignDate,omitempty"`
	FleetDepartmentSignature   string                     `json:"fleetDepartmentSignature,omitempty"`
	FleetDepartmentSignDate    string                     `json:"fleetDepartmentSignDate,omitempty"`
	Attachments                []VehicleSignoutAttachment `json:"attachments,omitempty"`
	CreatedBy                  string                     `json:"createdBy,omitempty"`
}

// UpdateVehicleSignoutPayload represents the payload to update an existing vehicle sign-out / handover.
type UpdateVehicleSignoutPayload struct {
	IsSignIn                   *bool                      `json:"isSignIn,omitempty"`
	SignDate                   string                     `json:"signDate,omitempty"`
	VehicleType                *int                       `json:"vehicleType,omitempty"`
	EmployeeID                 string                     `json:"employeeId,omitempty"`
	EmployeeName               string                     `json:"employeeName,omitempty"`
	RouteID                    string                     `json:"routeId,omitempty"`
	RouteName                  string                     `json:"routeName,omitempty"`
	CellPhone                  string                     `json:"cellPhone,omitempty"`
	DriverLicenseClass         string                     `json:"driverLicenseClass,omitempty"`
	DriverLicenseCondition     string                     `json:"driverLicenseCondition,omitempty"`
	UnitID                     *int                       `json:"unitId,omitempty"`
	UnitNumber                 string                     `json:"unitNumber,omitempty"`
	Odometer                   *float64                   `json:"odometer,omitempty"`
	LicensePlate               string                     `json:"licensePlate,omitempty"`
	CVIPDate                   string                     `json:"cvipDate,omitempty"`
	UnitYear                   *int                       `json:"unitYear,omitempty"`
	UnitMaker                  string                     `json:"unitMaker,omitempty"`
	UnitModel                  string                     `json:"unitModel,omitempty"`
	UnitColor                  string                     `json:"unitColor,omitempty"`
	FuelLevelID                *int                       `json:"fuelLevelId,omitempty"`
	FuelLevelDescription        string                     `json:"fuelLevelDescription,omitempty"`
	FuelTypeID                 *int                       `json:"fuelTypeId,omitempty"`
	FuelTypeDescription         string                     `json:"fuelTypeDescription,omitempty"`
	DocRegistrationSignIn      *bool                      `json:"docRegistrationSignIn,omitempty"`
	DocInsuranceSignIn         *bool                      `json:"docInsuranceSignIn,omitempty"`
	DocSafetyFitnessSignIn     *bool                      `json:"docSafetyFitnessSignIn,omitempty"`
	DocCollisionReportSignIn   *bool                      `json:"docCollisionReportSignIn,omitempty"`
	DocScheduleMaintenanceSignIn *bool                    `json:"docScheduleMaintenanceSignIn,omitempty"`
	DocSDSSignIn               *bool                      `json:"docSdsSignIn,omitempty"`
	CheckFireExtinguisher      *bool                      `json:"checkFireExtinguisher,omitempty"`
	CheckFirstAidKit           *bool                      `json:"checkFirstAidKit,omitempty"`
	CheckTriangles             *bool                      `json:"checkTriangles,omitempty"`
	CheckQstraints             *bool                      `json:"checkQstraints,omitempty"`
	CheckSeatBeltCutter        *bool                      `json:"checkSeatBeltCutter,omitempty"`
	CheckBroom                 *bool                      `json:"checkBroom,omitempty"`
	CheckSnowbrush             *bool                      `json:"checkSnowbrush,omitempty"`
	CheckCleankit              *bool                      `json:"checkCleankit,omitempty"`
	AcknowledgeCheck           *bool                      `json:"acknowledgeCheck,omitempty"`
	ConditionKey               string                     `json:"conditionKey,omitempty"`
	ConditionComments          string                     `json:"conditionComments,omitempty"`
	ParkingAddress             string                     `json:"parkingAddress,omitempty"`
	FireHallLocation           string                     `json:"fireHallLocation,omitempty"`
	DriverSignature            string                     `json:"driverSignature,omitempty"`
	DriverSignDate             string                     `json:"driverSignDate,omitempty"`
	FleetDepartmentSignature   string                     `json:"fleetDepartmentSignature,omitempty"`
	FleetDepartmentSignDate    string                     `json:"fleetDepartmentSignDate,omitempty"`
	Attachments                []VehicleSignoutAttachment `json:"attachments,omitempty"`
}
