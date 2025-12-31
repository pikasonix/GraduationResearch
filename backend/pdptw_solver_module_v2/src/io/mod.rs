#[cfg(not(feature = "classic-pdptw"))]
use crate::io::nyc_reader::NYCInstanceElements;
#[cfg(feature = "classic-pdptw")]
use crate::problem::pdptw::PDPTWInstance;

pub mod kdsp_writer;
#[cfg(feature = "classic-pdptw")]
pub mod li_lim_reader;
#[cfg(not(feature = "classic-pdptw"))]
pub mod nyc_reader;
#[cfg(feature = "classic-pdptw")]
pub mod sartori_buriol_reader;
pub mod sintef_solution;

#[cfg(not(feature = "classic-pdptw"))]
pub fn load_instance(
    path: impl Into<String> + Clone,
    _max_vehicles: Option<usize>,
) -> anyhow::Result<NYCInstanceElements> {
    let path = path.into();
    nyc_reader::load_instance(path.clone())
}

#[cfg(feature = "classic-pdptw")]
pub fn load_instance(
    path: impl Into<String> + Clone,
    max_vehicles: Option<usize>,
) -> anyhow::Result<PDPTWInstance> {
    load_instance_with_format(path, max_vehicles, "auto")
}

#[cfg(feature = "classic-pdptw")]
pub fn load_instance_with_format(
    path: impl Into<String> + Clone,
    max_vehicles: Option<usize>,
    format: &str,
) -> anyhow::Result<PDPTWInstance> {
    let path = path.into();
    
    match format {
        "lilim" => li_lim_reader::load_instance(path, max_vehicles),
        "sartori" => sartori_buriol_reader::load_instance(path, max_vehicles),
        "auto" | _ => {
            // Try Li&Lim first, then Sartori&Buriol
            li_lim_reader::load_instance(path.clone(), max_vehicles)
                .or_else(|_| sartori_buriol_reader::load_instance(path, max_vehicles))
        }
    }
}
