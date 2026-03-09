const { withXcodeProject } = require('@expo/config-plugins');

const QUICKPOSE_REPO = 'https://github.com/quickpose/quickpose-ios-sdk.git';
const QUICKPOSE_MIN_VERSION = '2.4.0';

function generateUUID() {
  const hex = '0123456789ABCDEF';
  return Array.from({ length: 24 }, () => hex[Math.floor(Math.random() * hex.length)]).join('');
}

function addQuickPoseSPM(xcodeProject) {
  const objects = xcodeProject.hash.project.objects;

  // Guard: skip if already added
  const existingRefs = objects['XCRemoteSwiftPackageReference'] || {};
  const alreadyAdded = Object.values(existingRefs).some(
    (ref) => typeof ref === 'object' && ref.repositoryURL === `"${QUICKPOSE_REPO}"`
  );
  if (alreadyAdded) {
    console.log('[withQuickPose] QuickPose SPM already present, skipping.');
    return;
  }

  const packageId = generateUUID();
  const coreProductId = generateUUID();
  const mpProductId = generateUUID();
  const coreBuildFileId = generateUUID();
  const mpBuildFileId = generateUUID();

  // 1. Add XCRemoteSwiftPackageReference
  objects['XCRemoteSwiftPackageReference'] = objects['XCRemoteSwiftPackageReference'] || {};
  objects['XCRemoteSwiftPackageReference'][packageId] = {
    isa: 'XCRemoteSwiftPackageReference',
    repositoryURL: `"${QUICKPOSE_REPO}"`,
    requirement: {
      kind: 'upToNextMajorVersion',
      minimumVersion: QUICKPOSE_MIN_VERSION,
    },
  };

  // 2. Add XCSwiftPackageProductDependency for QuickPoseCore and QuickPoseMP
  objects['XCSwiftPackageProductDependency'] = objects['XCSwiftPackageProductDependency'] || {};
  objects['XCSwiftPackageProductDependency'][coreProductId] = {
    isa: 'XCSwiftPackageProductDependency',
    package: packageId,
    productName: 'QuickPoseCore',
  };
  objects['XCSwiftPackageProductDependency'][mpProductId] = {
    isa: 'XCSwiftPackageProductDependency',
    package: packageId,
    productName: 'QuickPoseMP',
  };

  // 3. Add PBXBuildFile entries (for Frameworks phase)
  objects['PBXBuildFile'] = objects['PBXBuildFile'] || {};
  objects['PBXBuildFile'][coreBuildFileId] = {
    isa: 'PBXBuildFile',
    productRef: coreProductId,
    settings: {},
  };
  objects['PBXBuildFile'][mpBuildFileId] = {
    isa: 'PBXBuildFile',
    productRef: mpProductId,
    settings: {},
  };

  // 4. Add package reference to the project root
  const project = xcodeProject.getFirstProject().firstProject;
  project.packageReferences = project.packageReferences || [];
  project.packageReferences.push({
    value: packageId,
    comment: 'XCRemoteSwiftPackageReference "quickpose-ios-sdk"',
  });

  // 5. Add product dependencies + build files to the app target
  const appTarget = xcodeProject.getFirstTarget().firstTarget;
  appTarget.packageProductDependencies = appTarget.packageProductDependencies || [];
  appTarget.packageProductDependencies.push(
    { value: coreProductId, comment: 'QuickPoseCore' },
    { value: mpProductId, comment: 'QuickPoseMP' }
  );

  // 6. Add build files to PBXFrameworksBuildPhase
  const frameworksPhases = objects['PBXFrameworksBuildPhase'] || {};
  const buildPhaseRefs = appTarget.buildPhases || [];
  for (const phaseRef of buildPhaseRefs) {
    const phaseKey = phaseRef.value || phaseRef;
    const phase = frameworksPhases[phaseKey];
    if (phase && phase.isa === 'PBXFrameworksBuildPhase') {
      phase.files = phase.files || [];
      phase.files.push(
        { value: coreBuildFileId, comment: 'QuickPoseCore in Frameworks' },
        { value: mpBuildFileId, comment: 'QuickPoseMP in Frameworks' }
      );
      break;
    }
  }

  console.log('[withQuickPose] Successfully added QuickPose SPM package to Xcode project.');
}

module.exports = function withQuickPose(config) {
  return withXcodeProject(config, (config) => {
    addQuickPoseSPM(config.modResults);
    return config;
  });
};
